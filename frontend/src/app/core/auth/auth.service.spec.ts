import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { Subject, of } from 'rxjs';

import { CartService } from '../cart/cart.service';
import { SupabaseClientService } from '../database/supabase.client';
import { Profile } from '../models/profile.model';
import { AUTH_REPOSITORY } from '../repositories/auth.repository';
import { AuthService } from './auth.service';

describe('AuthService session bootstrap', () => {
  const buyerProfile: Profile = {
    id: 'buyer-1',
    full_name: 'Marcos Comprador',
    phone: '999999999',
    role: 'comprador',
    rating_average: 0,
    campus: 'Lima Norte',
  };

  let resolveSession: (value: any) => void;
  let profileSubject: Subject<Profile>;
  let authClient: jasmine.SpyObj<any>;
  let authStateCallback: (event: string, session: any) => void;
  let getProfile: jasmine.Spy;
  let signIn: jasmine.Spy;
  let signUp: jasmine.Spy;
  let supabaseClient: any;

  beforeEach(() => {
    spyOn(console, 'error');
    spyOn(console, 'log');
    const sessionPromise = new Promise(resolve => {
      resolveSession = resolve;
    });
    profileSubject = new Subject<Profile>();

    authClient = jasmine.createSpyObj('auth', ['getSession', 'onAuthStateChange']);
    authClient.getSession.and.returnValue(sessionPromise);
    authClient.onAuthStateChange.and.callFake((callback: (event: string, session: any) => void) => {
      authStateCallback = callback;
      return { data: { subscription: { unsubscribe: jasmine.createSpy('unsubscribe') } } };
    });

    const realtimeChannel: any = {};
    realtimeChannel.on = jasmine.createSpy('on').and.returnValue(realtimeChannel);
    realtimeChannel.subscribe = jasmine.createSpy('subscribe').and.returnValue(realtimeChannel);
    supabaseClient = {
      auth: authClient,
      channel: jasmine.createSpy('channel').and.returnValue(realtimeChannel),
      removeChannel: jasmine.createSpy('removeChannel'),
    };

    getProfile = jasmine.createSpy('getProfile').and.returnValue(profileSubject.asObservable());
    signIn = jasmine.createSpy('signIn');
    signUp = jasmine.createSpy('signUp');

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } },
        {
          provide: AUTH_REPOSITORY,
          useValue: {
            getProfile,
            signIn,
            signUp,
          },
        },
        { provide: SupabaseClientService, useValue: { client: supabaseClient } },
        { provide: CartService, useValue: { clearCart: jasmine.createSpy('clearCart') } },
        { provide: AlertController, useValue: { create: jasmine.createSpy('create') } },
      ],
    });
  });

  it('keeps initialization pending until the persisted profile is loaded', fakeAsync(() => {
    const service = TestBed.inject(AuthService);
    let initialized = true;
    service.isInitialized$.subscribe(value => initialized = value);

    expect(initialized).toBeFalse();

    resolveSession({
      data: { session: { user: { id: buyerProfile.id } } },
      error: null,
    });
    flushMicrotasks();

    expect(initialized).toBeFalse();

    profileSubject.next(buyerProfile);

    expect(service.currentProfileValue).toEqual(buyerProfile);
    expect(initialized).toBeTrue();
  }));

  it('finishes initialization without a profile when no session exists', fakeAsync(() => {
    const service = TestBed.inject(AuthService);
    let initialized = false;
    service.isInitialized$.subscribe(value => initialized = value);

    resolveSession({ data: { session: null }, error: null });
    flushMicrotasks();

    expect(service.currentProfileValue).toBeNull();
    expect(initialized).toBeTrue();
  }));

  it('finishes initialization safely when reading the session fails', fakeAsync(() => {
    const service = TestBed.inject(AuthService);
    let initialized = false;
    service.isInitialized$.subscribe(value => initialized = value);

    resolveSession({ data: { session: null }, error: new Error('storage unavailable') });
    flushMicrotasks();

    expect(service.currentProfileValue).toBeNull();
    expect(initialized).toBeTrue();
  }));

  it('ignores a profile response that arrives after sign out', fakeAsync(() => {
    const service = TestBed.inject(AuthService);
    resolveSession({
      data: { session: { user: { id: buyerProfile.id } } },
      error: null,
    });
    flushMicrotasks();

    authStateCallback('SIGNED_OUT', null);
    profileSubject.next(buyerProfile);

    expect(service.currentProfileValue).toBeNull();
  }));

  it('ignores the persisted session when sign out happens before getSession resolves', fakeAsync(() => {
    const service = TestBed.inject(AuthService);

    authStateCallback('SIGNED_OUT', null);
    resolveSession({
      data: { session: { user: { id: buyerProfile.id } } },
      error: null,
    });
    flushMicrotasks();

    expect(getProfile).not.toHaveBeenCalled();
    expect(service.currentProfileValue).toBeNull();
  }));

  it('ignores a sign-in profile that arrives after sign out', fakeAsync(() => {
    const service = TestBed.inject(AuthService);
    signIn.and.returnValue(of({ user: { id: buyerProfile.id } }));
    const cancellation = jasmine.createSpy('cancellation');

    service.signIn('buyer@ucvvirtual.edu.pe', 'password').subscribe({
      error: cancellation,
    });
    authStateCallback('SIGNED_OUT', null);
    profileSubject.next(buyerProfile);

    expect(service.currentProfileValue).toBeNull();
    expect(cancellation).toHaveBeenCalledWith(jasmine.objectContaining({
      message: jasmine.stringContaining('cancelada'),
    }));
  }));

  it('keeps sign-in active when a matching auth event arrives before the profile', fakeAsync(() => {
    const service = TestBed.inject(AuthService);
    signIn.and.returnValue(of({ user: { id: buyerProfile.id } }));
    const profileReceived = jasmine.createSpy('profileReceived');
    const authenticationError = jasmine.createSpy('authenticationError');

    service.signIn('buyer@ucvvirtual.edu.pe', 'password').subscribe({
      next: profileReceived,
      error: authenticationError,
    });
    authStateCallback('SIGNED_IN', { user: { id: buyerProfile.id } });
    profileSubject.next(buyerProfile);

    expect(profileReceived).toHaveBeenCalledWith(buyerProfile);
    expect(authenticationError).not.toHaveBeenCalled();
    expect(service.currentProfileValue).toEqual(buyerProfile);
    expect(getProfile).toHaveBeenCalledTimes(1);
  }));

  it('ignores a sign-up profile that arrives after sign out', fakeAsync(() => {
    const signUpProfile = new Subject<Profile>();
    signUp.and.returnValue(signUpProfile.asObservable());
    const service = TestBed.inject(AuthService);
    const cancellation = jasmine.createSpy('cancellation');

    service.signUp(
      'buyer@ucvvirtual.edu.pe',
      'password',
      buyerProfile.full_name,
      buyerProfile.phone,
      '1234567890',
      buyerProfile.role,
      buyerProfile.campus
    ).subscribe({
      error: cancellation,
    });
    authStateCallback('SIGNED_OUT', null);
    signUpProfile.next(buyerProfile);

    expect(service.currentProfileValue).toBeNull();
    expect(cancellation).toHaveBeenCalledWith(jasmine.objectContaining({
      message: jasmine.stringContaining('cancelada'),
    }));
  }));

  it('keeps the newest account profile and rebinds its realtime channel', fakeAsync(() => {
    const sellerProfile: Profile = {
      ...buyerProfile,
      id: 'seller-2',
      full_name: 'Emprendedor UCV',
      role: 'emprendedor',
    };
    const buyerRequest = new Subject<Profile>();
    const sellerRequest = new Subject<Profile>();
    getProfile.and.callFake((userId: string) =>
      userId === buyerProfile.id ? buyerRequest.asObservable() : sellerRequest.asObservable()
    );
    const service = TestBed.inject(AuthService);

    resolveSession({
      data: { session: { user: { id: buyerProfile.id } } },
      error: null,
    });
    flushMicrotasks();
    authStateCallback('SIGNED_IN', { user: { id: sellerProfile.id } });

    sellerRequest.next(sellerProfile);
    buyerRequest.next(buyerProfile);

    expect(service.currentProfileValue).toEqual(sellerProfile);
    expect(supabaseClient.channel).toHaveBeenCalledWith(`profile-updates-${buyerProfile.id}`);
    expect(supabaseClient.channel).toHaveBeenCalledWith(`profile-updates-${sellerProfile.id}`);
  }));
});
