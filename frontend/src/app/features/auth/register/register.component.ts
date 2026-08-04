import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { LoadingController, AlertController } from '@ionic/angular';
import { AuthService } from '../../../core/auth/auth.service';
import { UserRole } from '../../../core/models/profile.model';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
  standalone: false
})
export class RegisterComponent implements OnInit {
  registerForm!: FormGroup;
  showPassword = false;

  // Lista estática de campus de la UCV
  campuses: string[] = [
    'UCV - Lima Norte',
    'UCV - Lima Este',
    'UCV - Callao',
    'UCV - Ate',
    'UCV - Trujillo',
    'UCV - Piura',
    'UCV - Chiclayo',
    'UCV - Chimbote',
    'UCV - Huaraz',
    'UCV - Tarapoto',
    'UCV - Moyobamba'
  ];

  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private loadingCtrl = inject(LoadingController);
  private alertCtrl = inject(AlertController);

  ngOnInit() {
    this.registerForm = this.fb.group({
      fullName: ['', [Validators.required, Validators.minLength(4)]],
      email: ['', [Validators.required, Validators.email, Validators.pattern(/^[a-zA-Z0-9._%+-]+@ucv(virtual)?\.edu\.pe$/)]],
      phone: ['', [Validators.required, Validators.pattern(/^9[0-9]{8}$/)]], // Celular peruano estándar (9 dígitos)
      password: ['', [Validators.required, Validators.minLength(6)]],
      role: ['comprador', [Validators.required]],
      campus: ['UCV - Lima Norte', [Validators.required]]
    });
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  async onSubmit() {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    const { email, password, fullName, phone, role, campus } = this.registerForm.value;

    const loading = await this.loadingCtrl.create({
      message: 'Creando cuenta...',
      spinner: 'crescent',
      cssClass: 'custom-loading'
    });
    await loading.present();

    this.authService.signUp(email, password, fullName, phone, role as UserRole, campus).subscribe({
      next: (profile) => {
        loading.dismiss();
        this.showSuccessAlert(profile.role);
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
              this.router.navigate(['/seller']);
            } else {
              this.router.navigate(['/catalog']);
            }
          }
        }
      ],
      cssClass: 'custom-alert'
    });
    await alert.present();
  }
}
