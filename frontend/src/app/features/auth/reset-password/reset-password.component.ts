import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { LoadingController, ToastController } from '@ionic/angular';
import { SupabaseAuthRepository } from '../../../core/repositories/supabase/supabase-auth.repository';

@Component({
  selector: 'app-reset-password',
  standalone: false,
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.scss']
})
export class ResetPasswordComponent implements OnInit {
  resetForm!: FormGroup;
  showPassword = false;
  hasUrlToken = false;

  private refreshToken = '';

  private fb = inject(FormBuilder);
  private router = inject(Router);
  private loadingCtrl = inject(LoadingController);
  private toastCtrl = inject(ToastController);
  private supabaseRepo = inject(SupabaseAuthRepository);

  ngOnInit() {
    // Supabase envía el token de recuperación en el hash de la URL (#access_token=...)
    // Nota: en Angular el hash NO forma parte de router.url, se lee de window.location.hash
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const accessToken = hashParams.get('access_token') || '';
    const refreshToken = hashParams.get('refresh_token') || '';
    const recoveryType = hashParams.get('type') || '';

    // Fallback: también aceptamos un token manual en la query (?token=...)
    const tokenFromUrl = accessToken || this.router.parseUrl(this.router.url).queryParams['token'] || '';

    this.hasUrlToken = accessToken.length > 0 && (recoveryType === 'recovery' || refreshToken.length > 0);
    if (accessToken) {
      this.refreshToken = refreshToken;
    }

    this.resetForm = this.fb.group({
      token: [tokenFromUrl, Validators.required],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    });
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  async onSubmit() {
    if (this.resetForm.invalid) {
      this.resetForm.markAllAsTouched();
      return;
    }
    const { token, password, confirmPassword } = this.resetForm.value;
    if (password !== confirmPassword) {
      await this.showToast('Las contraseñas no coinciden');
      return;
    }

    const loading = await this.loadingCtrl.create({
      message: 'Restableciendo contraseña...',
      spinner: 'crescent',
      cssClass: 'custom-loading'
    });
    await loading.present();

    this.supabaseRepo.confirmResetPassword(token, password, this.refreshToken).subscribe({
      next: async () => {
        await loading.dismiss();
        await this.showToast('Contraseña restablecida correctamente', 'success');
        this.router.navigate(['/login']);
      },
      error: async (err: any) => {
        await loading.dismiss();
        await this.showToast(err.message || 'Error al restablecer la contraseña');
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
}
