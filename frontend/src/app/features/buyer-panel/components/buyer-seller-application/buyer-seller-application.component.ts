import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { LoadingController, ToastController } from '@ionic/angular';
import { SellerApplicationRepository } from '../../../../core/repositories/seller-application.repository';
import { AuthService } from '../../../../core/auth/auth.service';

@Component({
  selector: 'app-buyer-seller-application',
  templateUrl: './buyer-seller-application.component.html',
  styleUrls: ['./buyer-seller-application.component.scss'],
  standalone: false
})
export class BuyerSellerApplicationComponent implements OnInit {
  applicationForm: FormGroup;
  selectedLogo: File | null = null;
  logoPreview: string | null = null;
  userId: string | null = null;

  private fb = inject(FormBuilder);
  private router = inject(Router);
  private loadingCtrl = inject(LoadingController);
  private toastCtrl = inject(ToastController);
  private applicationRepo = inject(SellerApplicationRepository);
  private authService = inject(AuthService);

  constructor() {
    this.applicationForm = this.fb.group({
      dni: ['', [Validators.required, Validators.pattern('^[0-9]{8}$')]],
      full_name: ['', [Validators.required, Validators.pattern('^[a-zA-ZáéíóúÁÉÍÓÚñÑ\\s]+$')]],
      business_name: ['', [Validators.required, Validators.pattern('^[a-zA-ZáéíóúÁÉÍÓÚñÑ0-9\\s]+$')]], // Allowing numbers for business names is safer, but user asked for "solo letras", so:
      // wait, user said "solo letras y nombres de emprendimientos únicos"
      // Wait, let's use pattern for letters only as strictly requested:
      // Actually, business name: '^[a-zA-ZáéíóúÁÉÍÓÚñÑ\\s]+$'
      category: ['', Validators.required],
      open_time: ['08:00', Validators.required],
      close_time: ['18:00', Validators.required],
      description: ['', Validators.required],
      phone: ['', [Validators.required, Validators.pattern('^[0-9]{9}$')]],
      delivery_points: ['', Validators.required]
    });
  }

  ngOnInit() {
    this.authService.currentProfile$.subscribe(profile => {
      if (profile) {
        this.userId = profile.id;
        // Pre-fill some fields if possible
        this.applicationForm.patchValue({
          full_name: profile.full_name || '',
          phone: profile.phone || ''
        });
      }
    });
    
    // Override business name pattern as requested: only letters
    this.applicationForm.get('business_name')?.setValidators([Validators.required, Validators.pattern('^[a-zA-ZáéíóúÁÉÍÓÚñÑ\\s]+$')]);
  }

  onLogoSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedLogo = file;
      const reader = new FileReader();
      reader.onload = () => {
        this.logoPreview = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  async submitApplication() {
    if (this.applicationForm.invalid) {
      this.applicationForm.markAllAsTouched();
      this.showToast('Por favor, completa todos los campos correctamente.', 'warning');
      return;
    }

    if (!this.selectedLogo) {
      this.showToast('Por favor, selecciona un logo o foto para tu emprendimiento.', 'warning');
      return;
    }

    if (!this.userId) {
      this.showToast('No se pudo identificar tu sesión. Por favor, inicia sesión nuevamente.', 'danger');
      return;
    }

    const loading = await this.loadingCtrl.create({
      message: 'Validando...',
      spinner: 'crescent'
    });
    await loading.present();

    const formValues = this.applicationForm.value;

    try {
      // 1. Check if business name is unique
      const isUnique = await this.applicationRepo.checkBusinessNameUnique(formValues.business_name.trim()).toPromise();
      if (!isUnique) {
        loading.dismiss();
        this.showToast('El nombre del emprendimiento ya está en uso. Por favor, elige otro.', 'danger');
        return;
      }

      loading.message = 'Subiendo imagen...';
      
      // 2. Upload Logo
      const logoUrl = await this.applicationRepo.uploadLogo(this.selectedLogo, this.userId);

      loading.message = 'Enviando solicitud...';

      // 3. Submit Application
      const application = {
        dni: formValues.dni,
        full_name: formValues.full_name.trim(),
        business_name: formValues.business_name.trim(),
        business_category: formValues.category,
        open_time: formValues.open_time,
        close_time: formValues.close_time,
        logo_url: logoUrl,
        description: formValues.description.trim(),
        phone: formValues.phone,
        delivery_points: formValues.delivery_points.trim()
      };

      await this.applicationRepo.submitApplication(application, this.userId).toPromise();

      loading.dismiss();
      this.showToast('¡Solicitud enviada con éxito! Será revisada por un administrador.', 'success');
      this.router.navigate(['/buyer-panel/profile']);
      
    } catch (error: any) {
      loading.dismiss();
      console.error(error);
      this.showToast(error.message || 'Ocurrió un error al enviar tu solicitud.', 'danger');
    }
  }

  goBack() {
    this.router.navigate(['/buyer-panel/profile']);
  }

  private async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color,
      position: 'bottom'
    });
    await toast.present();
  }
}
