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

  private fb = inject(FormBuilder);
  private router = inject(Router);
  private loadingCtrl = inject(LoadingController);
  private toastCtrl = inject(ToastController);
  private supabaseRepo = inject(SupabaseAuthRepository);

  ngOnInit() {
    // Try to auto-populate the token if present in URL
    const urlTree = this.router.parseUrl(this.router.url);
    const tokenFromUrl = urlTree.queryParams['token'] || '';

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

    this.supabaseRepo.confirmResetPassword(token, password).subscribe({
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
