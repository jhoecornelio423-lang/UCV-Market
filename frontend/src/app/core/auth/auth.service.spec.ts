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

  beforeEach(() => {
    spyOn(console, 'error');
    const sessionPromise = new Promise(resolve => {
      resolveSession = resolve;
    });
    profileSubject = new Subject<Profile>();

    authClient = jasmine.createSpyObj('auth', ['getSession', 'onAuthStateChange']);
    authClient.getSession.and.returnValue(sessionPromise);
    authClient.onAuthStateChange.and.returnValue({
      data: { subscription: { unsubscribe: jasmine.createSpy('unsubscribe') } },
    });

    const realtimeChannel: any = {};
    realtimeChannel.on = jasmine.createSpy('on').and.returnValue(realtimeChannel);
    realtimeChannel.subscribe = jasmine.createSpy('subscribe').and.returnValue(realtimeChannel);
    const supabaseClient = {
      auth: authClient,
      channel: jasmine.createSpy('channel').and.returnValue(realtimeChannel),
      removeChannel: jasmine.createSpy('removeChannel'),
    };

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } },
        {
          provide: AUTH_REPOSITORY,
          useValue: {
            getProfile: jasmine.createSpy('getProfile').and.returnValue(profileSubject.asObservable()),
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
});
