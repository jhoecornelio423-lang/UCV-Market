import { Component, OnInit, inject } from '@angular/core';
import { SellerStateService } from '../../services/seller-state.service';
import { LoadingController, ToastController, ActionSheetController } from '@ionic/angular';
import { AuthService } from '../../../../core/auth/auth.service';
import { Profile } from '../../../../core/models/profile.model';
import { Observable } from 'rxjs';
import { PRODUCT_REPOSITORY } from '../../../../core/repositories/product.repository';

@Component({
  selector: 'app-seller-business',
  templateUrl: './seller-business.component.html',
  styleUrls: ['./seller-business.component.scss'],
  standalone: false
})
export class SellerBusinessComponent implements OnInit {
  private sellerState = inject(SellerStateService);
  private loadingCtrl = inject(LoadingController);
  private toastCtrl = inject(ToastController);
  private authService = inject(AuthService);
  private actionSheetCtrl = inject(ActionSheetController);

  bName: string = '';
  bCategory: string = '';
  bDescription: string = '';
  bLocation: string = '';
  bOpenTime: string = '08:00';
  bCloseTime: string = '18:00';
  bAcceptingOrders: boolean = true;
  bPushEnabled: boolean = true;
  businessBannerUrl: string = 'assets/images/login-food-banner.jpg';
  businessAvatarUrl: string = 'assets/images/default-avatar.png';
  selectedBannerFile: File | null = null;
  selectedAvatarFile: File | null = null;
  private bannerFallbackApplied = false;
  private avatarFallbackApplied = false;

  ngOnInit() {
    this.loadBusinessData();
  }

  loadBusinessData() {
    const userProfile = this.sellerState.currentUserProfile;
    if (userProfile) {
      this.bName = userProfile.full_name || 'Mi Emprendimiento';
      this.bDescription = userProfile.business_description || '';
      this.bCategory = userProfile.business_category || '';
      this.bLocation = userProfile.business_location || '';
      this.bOpenTime = userProfile.open_time || '08:00';
      this.bCloseTime = userProfile.close_time || '18:00';
      this.bAcceptingOrders = userProfile.accepting_orders ?? true;
      this.bPushEnabled = userProfile.push_notifications_enabled ?? true;
      this.businessBannerUrl = userProfile.banner_url || 'assets/images/login-food-banner.jpg';
      this.businessAvatarUrl = userProfile.avatar_url || 'assets/images/default-avatar.png';
    }
  }

  onBannerError() {
    if (this.bannerFallbackApplied) return;
    this.bannerFallbackApplied = true;
    this.businessBannerUrl = 'assets/images/login-food-banner.jpg';
  }

  onAvatarError() {
    if (this.avatarFallbackApplied) return;
    this.avatarFallbackApplied = true;
    this.businessAvatarUrl = 'assets/images/default-avatar.png';
  }

  onBannerSelected(event: any) {
    const file = event.target.files?.[0];
    if (file) {
      this.selectedBannerFile = file;
      const reader = new FileReader();
      reader.onload = () => {
        this.businessBannerUrl = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  onAvatarSelected(event: any) {
    const file = event.target.files?.[0];
    if (file) {
      this.selectedAvatarFile = file;
      const reader = new FileReader();
      reader.onload = () => {
        this.businessAvatarUrl = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  async saveBusinessInfo() {
    const userProfile = this.sellerState.currentUserProfile;
    if (!userProfile) return;

    const loading = await this.loadingCtrl.create({
      message: 'Guardando datos del negocio...',
      spinner: 'crescent'
    });
    await loading.present();

    const userId = userProfile.id;
    const uploadTasks: { [key: string]: Observable<string> } = {};

    if (this.selectedBannerFile) {
      const extension = this.selectedBannerFile.name.split('.').pop() || 'jpg';
      const filePath = `banners/${userId}_banner.${extension}`;
      uploadTasks['banner'] = this.authService.uploadBusinessAsset(filePath, this.selectedBannerFile);
    }

    if (this.selectedAvatarFile) {
      const extension = this.selectedAvatarFile.name.split('.').pop() || 'jpg';
      const filePath = `avatars/${userId}_avatar.${extension}`;
      uploadTasks['avatar'] = this.authService.uploadBusinessAsset(filePath, this.selectedAvatarFile);
    }

    const saveDetails = (bannerUrl?: string, avatarUrl?: string) => {
      const updatedProfile: Partial<Profile> = {
        full_name: this.bName,
        business_description: this.bDescription,
        business_category: this.bCategory,
        business_location: this.bLocation,
        open_time: this.bOpenTime,
        close_time: this.bCloseTime,
        accepting_orders: this.bAcceptingOrders,
        push_notifications_enabled: this.bPushEnabled
      };

      if (bannerUrl) updatedProfile.banner_url = bannerUrl;
      if (avatarUrl) updatedProfile.avatar_url = avatarUrl;

      this.authService.updateProfile(updatedProfile).subscribe({
        next: () => {
          loading.dismiss();
          this.showToast('Datos del negocio actualizados.', 'success');
          // Actualizar en el estado global
          const profile = this.sellerState.currentUserProfile;
          if(profile) {
              Object.assign(profile, updatedProfile);
              this.sellerState['userProfileSubject'].next(profile);
          }
        },
        error: (err) => {
          loading.dismiss();
          console.error(err);
          this.showToast('Error al guardar datos.', 'danger');
        }
      });
    };

    const taskKeys = Object.keys(uploadTasks);
    if (taskKeys.length === 0) {
      saveDetails();
    } else {
      let completed = 0;
      let finalBannerUrl = '';
      let finalAvatarUrl = '';

      for (const key of taskKeys) {
        uploadTasks[key].subscribe({
          next: (url) => {
            if (key === 'banner') finalBannerUrl = url;
            if (key === 'avatar') finalAvatarUrl = url;
            completed++;
            if (completed === taskKeys.length) {
              saveDetails(finalBannerUrl, finalAvatarUrl);
            }
          },
          error: (err) => {
            loading.dismiss();
            console.error(`Error uploading ${key}:`, err);
            this.showToast(`Error al subir imagen de ${key}.`, 'danger');
          }
        });
      }
    }
  }

  private async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 1500,
      color,
      position: 'bottom'
    });
    await toast.present();
  }

  async contactSupport() {
    const actionSheet = await this.actionSheetCtrl.create({
      header: '¿En qué podemos ayudarte?',
      cssClass: 'support-action-sheet',
      buttons: [
        {
          text: 'Reportar un problema',
          icon: 'warning-outline',
          handler: () => this.sendSupportEmail('Reportar un problema')
        },
        {
          text: 'Ayuda con la aplicación',
          icon: 'help-circle-outline',
          handler: () => this.sendSupportEmail('Ayuda con la aplicación')
        },
        {
          text: 'Error en productos o pagos',
          icon: 'bug-outline',
          handler: () => this.sendSupportEmail('Error en productos o pagos')
        },
        {
          text: 'Otro motivo',
          icon: 'ellipsis-horizontal-outline',
          handler: () => this.sendSupportEmail('Soporte VALLE-GO')
        },
        {
          text: 'Cancelar',
          icon: 'close',
          role: 'cancel'
        }
      ]
    });
    await actionSheet.present();
  }

  private sendSupportEmail(subject: string) {
    const email = 'soporte@ucvmarket.com';
    const body = 'Hola equipo de soporte,%0A%0AEscribo por el siguiente motivo:%0A%0A';
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${body}`;
  }
}
