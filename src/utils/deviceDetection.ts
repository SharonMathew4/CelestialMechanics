/**
 * Device Detection Utilities
 * 
 * Detects mobile devices and tablets based on user agent string.
 * Used to block access from non-desktop devices.
 */

export function isMobileDevice(): boolean {
    if (typeof navigator === 'undefined') return false;

    const ua = navigator.userAgent.toLowerCase();
    const mobileRegex = /android|webos|iphone|ipod|blackberry|iemobile|opera mini|mobile/i;

    return mobileRegex.test(ua);
}

export function isTablet(): boolean {
    if (typeof navigator === 'undefined') return false;

    const ua = navigator.userAgent.toLowerCase();
    const tabletRegex = /ipad|android(?!.*mobile)|tablet|kindle|playbook|silk/i;

    return tabletRegex.test(ua) && !isMobileDevice();
}

export function isDesktop(): boolean {
    return !isMobileDevice() && !isTablet();
}

export function getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
    if (isMobileDevice()) return 'mobile';
    if (isTablet()) return 'tablet';
    return 'desktop';
}

export function shouldBlockAccess(): boolean {
    // Block mobile phones, allow tablets in landscape as optional
    return isMobileDevice();
}
