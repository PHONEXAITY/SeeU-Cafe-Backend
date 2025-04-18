export interface SlideshowSettings {
  id: number;
  autoplay: boolean;
  interval: number;
  transition: string;
  transitionDuration: number;
  showArrows: boolean;
  showDots: boolean;
  pauseOnHover: boolean;
  height: number;
  responsive: boolean;
  maxSlides: number;
  enableOverlay: boolean;
  overlayColor: string;
  animateText: boolean;
  textPosition: string;
}
