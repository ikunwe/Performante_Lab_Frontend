import { DOCUMENT } from '@angular/common';
import { Component, afterNextRender, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { AUTH_NEXT_KEY, loginDestination } from '../../../core/auth/auth-client';
import { Icon } from '../../../shared/ui/icon/icon';

@Component({
  selector: 'app-auth-callback',
  imports: [RouterLink, Icon],
  template: `
    <main class="flex min-h-dvh items-center justify-center bg-[#090909] p-6 text-stone-100">
      <section
        class="w-full max-w-md rounded-lg border border-white/10 bg-[#151515] p-8 text-center"
        aria-live="polite"
      >
        @if (!failed()) {
          <app-icon
            name="spinner"
            class="mb-5 !size-7 animate-spin text-red-400 motion-reduce:animate-none"
          />
        }
        <h1 class="text-xl">{{ failed() ? 'เข้าสู่ระบบไม่สำเร็จ' : 'กำลังเข้าสู่ระบบ' }}</h1>
        <p class="mt-4 text-sm leading-relaxed text-stone-400">
          {{ failed() ? auth.error() : 'กำลังยืนยันบัญชี Google กรุณารอสักครู่…' }}
        </p>
        @if (failed()) {
          <a
            routerLink="/login"
            [queryParams]="{ next: next }"
            class="mt-6 inline-flex min-h-11 cursor-pointer items-center rounded-lg bg-[#ce281a] px-5 text-sm"
            >กลับไปหน้าเข้าสู่ระบบ</a
          >
        }
      </section>
    </main>
  `,
})
export class AuthCallback {
  readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  readonly failed = signal(false);
  next = '/discover';

  constructor() {
    afterNextRender(() => {
      void this.finish();
    });
  }

  private async finish(): Promise<void> {
    const query = this.route.snapshot.queryParamMap;
    try {
      const storage = this.document.defaultView?.sessionStorage;
      this.next = loginDestination(query.get('next') ?? storage?.getItem(AUTH_NEXT_KEY) ?? null);
      storage?.removeItem(AUTH_NEXT_KEY);
    } catch {
      this.next = '/discover';
    }
    const hash = new URLSearchParams(this.document.defaultView?.location.hash.slice(1));
    const code = query.get('code');
    const denied = query.has('error') || hash.has('error');
    // Remove credentials/error parameters from browser history, including failure paths.
    this.document.defaultView?.history.replaceState(null, '', this.document.location.pathname);
    if (await this.auth.completeCallback(code, denied)) {
      await this.router.navigateByUrl(this.next, { replaceUrl: true });
    } else {
      this.failed.set(true);
    }
  }
}
