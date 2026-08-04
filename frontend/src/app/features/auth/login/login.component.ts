import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { LoadingController, AlertController, ToastController } from '@ionic/angular';
import { AuthService } from '../../../core/auth/auth.service';
import { SupabaseAuthRepository } from '../../../core/repositories/supabase/supabase-auth.repository';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  standalone: false
})
export class LoginComponent implements OnInit {
  loginForm!: FormGroup;
  showPassword = false;

  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private supabaseRepo = inject(SupabaseAuthRepository);
  private router = inject(Router);
  private loadingCtrl = inject(LoadingController);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);

  ngOnInit() {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });

    // Redirigir si ya está autenticado
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/catalog']);
    }
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  async onForgotPassword() {
    const email = this.loginForm.get('email')?.value;
    if (!email) {
      await this.showToast('Ingresa tu email');
      return;
    }
    const loading = await this.loadingCtrl.create({
      message: 'Enviando correo...',
      spinner: 'crescent',
      cssClass: 'custom-loading'
    });
    await loading.present();
    this.authService.resetPassword(email).subscribe({
      next: async () => {
        await loading.dismiss();
        
        const alert = await this.alertCtrl.create({
          header: 'Correo Enviado',
          subHeader: 'Token de recuperación enviado',
          message: 'Hemos enviado un correo a tu cuenta UCV con el token de recuperación. Copia el token del mensaje e ingrésalo en la pantalla de restablecimiento.',
          buttons: [
            {
              text: 'Cancelar',
              role: 'cancel'
            },
            {
              text: 'Restablecer',
              handler: () => {
                this.router.navigate(['/login/reset-password']);
              }
            }
          ],
          cssClass: 'custom-alert'
        });
        await alert.present();
      },
      error: async (err: any) => {
        await loading.dismiss();
        await this.showToast(err.message || 'Error al enviar el correo');
      }
    });
  }

  private async showToast(message: string, color: string = 'danger') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      position: 'top',
      color
    });
    await toast.present();
  }

  async onSubmit() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const { email, password } = this.loginForm.value;

    const loading = await this.loadingCtrl.create({
      message: 'Iniciando sesión...',
      spinner: 'crescent',
      cssClass: 'custom-loading'
    });
    await loading.present();

    this.authService.signIn(email, password).subscribe({
      next: (profile) => {
        loading.dismiss();
        if (profile.role === 'admin') {
          this.router.navigate(['/admin']);
        } else if (profile.role === 'emprendedor') {
          this.router.navigate(['/seller']);
        } else {
          this.router.navigate(['/catalog']);
        }
      },
      error: async (err) => {
        loading.dismiss();
        const alert = await this.alertCtrl.create({
          header: 'Fallo al iniciar sesión',
          message: err.message || 'Credenciales inválidas. Inténtalo de nuevo.',
          buttons: ['Entendido'],
          cssClass: 'custom-alert'
        });
        await alert.present();
      }
    });
  }
}
