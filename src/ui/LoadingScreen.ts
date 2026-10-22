export class LoadingScreen {
  private container: HTMLElement | null;
  private progressBar: HTMLElement | null;
  private statusText: HTMLElement | null;

  constructor() {
    this.container = document.getElementById('loading-container');
    this.progressBar = document.getElementById('progress-bar-fill');
    this.statusText = document.getElementById('loading-status');
  }

  public setProgress(percentage: number, message?: string): void {
    if (this.progressBar) {
      this.progressBar.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
    }
    if (message && this.statusText) {
      this.statusText.textContent = message;
      this.statusText.classList.remove('error');
    }
  }

  public showError(message: string): void {
    if (this.statusText) {
      this.statusText.textContent = `Error: ${message}`;
      this.statusText.classList.add('error');
    }
  }

  public show(): void {
    if (this.container) {
      this.container.style.display = '';
      this.container.classList.remove('hidden');
    }
  }

  public hide(): void {
    if (this.container) {
      this.container.classList.add('hidden');
      setTimeout(() => {
        if (this.container) {
          this.container.style.display = 'none';
        }
      }, 500);
    }
  }
}
