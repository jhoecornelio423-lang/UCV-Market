import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { LoadingController, AlertController } from '@ionic/angular';
import { AuthService } from '../../../core/auth/auth.service';
import { UserRole } from '../../../core/models/profile.model';
import { SellerApplicationRepository } from '../../../core/repositories/seller-application.repository';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
  standalone: false
})
export class RegisterComponent implements OnInit {
  registerForm!: FormGroup;
  showPassword = false;
  selectedLogo: File | null = null;
  logoPreview: string | null = null;

  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private loadingCtrl = inject(LoadingController);
  private alertCtrl = inject(AlertController);
  private applicationRepo = inject(SellerApplicationRepository);

  ngOnInit() {
    this.registerForm = this.fb.group({
      fullName: ['', [Validators.required, Validators.minLength(4)]],
      email: ['', [Validators.required, Validators.email, Validators.pattern(/^[a-zA-Z0-9._%+-]+@ucv(virtual)?\.edu\.pe$/)]],
      studentCode: ['', [Validators.required, Validators.pattern(/^[0-9]{8,10}$/)]],
      phone: ['', [Validators.required, Validators.pattern(/^9[0-9]{8}$/)]], // Celular peruano estándar (9 dígitos)
      password: ['', [Validators.required, Validators.minLength(6)]],
      role: ['comprador', [Validators.required]],
      acceptTerms: [false, [Validators.requiredTrue]],
      campus: ['UCV - Lima Norte', [Validators.required]],
      
      // Seller fields (conditionally validated)
      dni: [''],
      business_name: [''],
      category: [''],
      open_time: ['08:00'],
      close_time: ['18:00'],
      description: [''],
      delivery_points: ['']
    });

    this.registerForm.get('role')?.valueChanges.subscribe(role => {
      this.updateValidators(role);
    });
  }

  updateValidators(role: string) {
    const sellerFields = ['dni', 'business_name', 'category', 'open_time', 'close_time', 'description', 'delivery_points'];
    
    if (role === 'emprendedor') {
      this.registerForm.get('dni')?.setValidators([Validators.required, Validators.pattern('^[0-9]{8}$')]);
      this.registerForm.get('business_name')?.setValidators([Validators.required, Validators.pattern('^[a-zA-ZáéíóúÁÉÍÓÚñÑ\\s]+$')]);
      this.registerForm.get('category')?.setValidators([Validators.required]);
      this.registerForm.get('description')?.setValidators([Validators.required]);
      this.registerForm.get('delivery_points')?.setValidators([Validators.required]);
    } else {
      sellerFields.forEach(field => {
        this.registerForm.get(field)?.clearValidators();
        this.registerForm.get(field)?.updateValueAndValidity();
      });
    }

    sellerFields.forEach(field => this.registerForm.get(field)?.updateValueAndValidity());
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

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  async onSubmit() {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    const formValues = this.registerForm.value;
    const { email, password, fullName, phone, studentCode, role, campus } = formValues;

    if (role === 'emprendedor' && !this.selectedLogo) {
      const alert = await this.alertCtrl.create({
        header: 'Logo requerido',
        message: 'Debes subir un logo o foto de tu emprendimiento.',
        buttons: ['Ok']
      });
      await alert.present();
      return;
    }

    const loading = await this.loadingCtrl.create({
      message: 'Creando cuenta...',
      spinner: 'crescent',
      cssClass: 'custom-loading'
    });
    await loading.present();

    if (role === 'emprendedor') {
      try {
        const isUnique = await this.applicationRepo.checkBusinessNameUnique(formValues.business_name.trim()).toPromise();
        if (!isUnique) {
          loading.dismiss();
          const alert = await this.alertCtrl.create({
            header: 'Nombre no disponible',
            message: 'El nombre del emprendimiento ya está en uso. Por favor, elige otro.',
            buttons: ['Ok']
          });
          await alert.present();
          return;
        }
      } catch (err) {
        // Continue if checking fails
      }
    }

    const finalRole = 'comprador'; // Always register as buyer first

    this.authService.signUp(email, password, fullName, phone, studentCode, finalRole as UserRole, campus).subscribe({
      next: async (profile) => {
        
        if (role === 'emprendedor' && this.selectedLogo) {
          loading.message = 'Enviando solicitud...';
          try {
            const logoUrl = await this.applicationRepo.uploadLogo(this.selectedLogo, profile.id);
            const application = {
              dni: formValues.dni,
              full_name: fullName.trim(),
              business_name: formValues.business_name.trim(),
              business_category: formValues.category,
              open_time: formValues.open_time,
              close_time: formValues.close_time,
              logo_url: logoUrl,
              description: formValues.description.trim(),
              phone: phone,
              delivery_points: formValues.delivery_points.trim()
            };
            await this.applicationRepo.submitApplication(application, profile.id).toPromise();
          } catch (appErr) {
            console.error('Error submitting application:', appErr);
          }
        }

        loading.dismiss();
        this.showSuccessAlert(role as UserRole);
      },
      error: async (err) => {
        loading.dismiss();
        const alert = await this.alertCtrl.create({
          header: 'Fallo al registrarse',
          message: err.message || 'Ocurrió un error al crear la cuenta. Inténtalo de nuevo.',
          buttons: ['Entendido'],
          cssClass: 'custom-alert'
        });
        await alert.present();
      }
    });
  }

  async showSuccessAlert(role: UserRole) {
    const alert = await this.alertCtrl.create({
      header: '¡Registro Exitoso!',
      message: 'Tu cuenta ha sido creada correctamente. Se ha enviado un enlace de confirmación a tu correo institucional.',
      buttons: [
        {
          text: 'Ingresar',
          handler: () => {
            if (role === 'emprendedor') {
              // Now they don't need to go to the form, they go straight to profile where it shows "Pending"
              this.router.navigate(['/buyer-panel/profile']);
            } else {
              this.router.navigate(['/buyer-panel/catalog']);
            }
          }
        }
      ],
      cssClass: 'custom-alert'
    });
    await alert.present();
  }
}
