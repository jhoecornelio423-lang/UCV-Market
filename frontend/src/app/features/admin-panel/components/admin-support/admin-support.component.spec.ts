import { TestBed } from '@angular/core/testing';
import { AlertController, ToastController } from '@ionic/angular';
import { AdminRepository } from '../../../../core/repositories/admin.repository';
import { SupabaseClientService } from '../../../../core/database/supabase.client';
import { AdminSupportComponent } from './admin-support.component';

describe('AdminSupportComponent terminal state safety', () => {
  let component: AdminSupportComponent;
  let adminRepo: jasmine.SpyObj<AdminRepository>;
  let alertController: jasmine.SpyObj<AlertController>;

  beforeEach(() => {
    adminRepo = jasmine.createSpyObj<AdminRepository>('AdminRepository', [
      'updateTicketStatus', 'setTicketPriority', 'linkSeller', 'linkOrder',
      'dismissTicket', 'warnSeller', 'banSeller', 'getSellers', 'getOrdersForLinking',
    ]);
    alertController = jasmine.createSpyObj<AlertController>('AlertController', ['create']);

    TestBed.configureTestingModule({
      providers: [
        { provide: AdminRepository, useValue: adminRepo },
        { provide: AlertController, useValue: alertController },
        { provide: ToastController, useValue: jasmine.createSpyObj('ToastController', ['create']) },
        { provide: SupabaseClientService, useValue: { client: {} } },
      ],
    });
    component = TestBed.runInInjectionContext(() => new AdminSupportComponent());
  });

  for (const status of ['resolved', 'rejected', 'closed']) {
    it(`treats ${status} as terminal and read-only`, async () => {
      component.selectedTicket = {
        id: 'ticket-1', status, seller_id: 'seller-1', order_id: null,
      } as any;

      expect(component.isTerminalTicket).toBeTrue();
      expect(component.canWrite).toBeFalse();

      component.onStatusChange('open');
      component.onPriorityChange('alto');
      await component.linkSeller();
      await component.linkOrder();
      await component.dismissTicket();
      await component.warnSeller();
      await component.banSeller();

      expect(adminRepo.updateTicketStatus).not.toHaveBeenCalled();
      expect(adminRepo.setTicketPriority).not.toHaveBeenCalled();
      expect(alertController.create).not.toHaveBeenCalled();
    });
  }
});
