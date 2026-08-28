import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { NEVER, of } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { SupabaseClientService } from '../../core/database/supabase.client';
import { SupportRepository } from '../../core/repositories/support.repository';
import { SupportPageComponent } from './support-page.component';

describe('SupportPageComponent accessibility', () => {
  let fixture: ComponentFixture<SupportPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SupportPageComponent],
      imports: [IonicModule.forRoot(), FormsModule],
      providers: [
        { provide: Router, useValue: { url: '/seller/support', events: NEVER, navigate: jasmine.createSpy() } },
        { provide: AuthService, useValue: { currentProfileValue: { id: 'seller-1', full_name: 'Vendedor' } } },
        { provide: SupportRepository, useValue: { getMyTickets: () => of([]) } },
        { provide: SupabaseClientService, useValue: { client: { removeChannel: jasmine.createSpy() } } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(SupportPageComponent);
    fixture.detectChanges();
  });

  it('labels navigation and new-ticket fields', () => {
    const component = fixture.componentInstance;
    component.showNewTicketForm = true;
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('ion-back-button')?.getAttribute('aria-label')).toBe('Volver');
    expect(root.querySelector('label[for="support-subject"]')).not.toBeNull();
    expect(root.querySelector('label[for="support-description"]')).not.toBeNull();
  });

  it('labels conversation controls', () => {
    fixture.componentInstance.selectedTicket = {
      id: 'ticket-1', user_id: 'buyer-1', seller_id: 'seller-1', subject: 'Consulta',
      message: 'Ayuda', status: 'open', priority: 'medio', created_at: '2026-08-01T10:00:00',
    } as any;
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('.conversation-header .back-btn')?.getAttribute('aria-label')).toBe('Volver a conversaciones');
    expect(root.querySelector('.composer input')?.getAttribute('aria-label')).toBe('Mensaje para soporte');
    expect(root.querySelector('.composer button')?.getAttribute('aria-label')).toBe('Enviar mensaje');
  });
});
