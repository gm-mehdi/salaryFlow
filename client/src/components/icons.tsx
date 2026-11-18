"use client";

import type { ReactNode } from "react";

export function I({ children, size = 20 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export const IconHome = () => (<I><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" /></I>);
export const IconList = () => (<I><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></I>);
export const IconRepeat = () => (<I><path d="m17 2 4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" /><path d="m7 22-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" /></I>);
export const IconTarget = () => (<I><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></I>);
export const IconChart = () => (<I><path d="M3 3v16a2 2 0 0 0 2 2h16" /><path d="M7 15v3M12 10v8M17 6v12" /></I>);
export const IconSliders = () => (<I><path d="M4 6h9M19 6h1M4 12h3M13 12h7M4 18h11" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></I>);
export const IconPlus = ({ size = 22 }: { size?: number }) => (<I size={size}><path d="M12 5v14M5 12h14" /></I>);
export const IconX = () => (<I size={18}><path d="M18 6 6 18M6 6l12 12" /></I>);
export const IconCheck = () => (<I size={18}><path d="M20 6 9 17l-5-5" /></I>);
export const IconTrash = () => (<I size={17}><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" /></I>);
export const IconPencil = () => (<I size={15}><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></I>);
export const IconChevronLeft = () => (<I size={20}><path d="m15 18-6-6 6-6" /></I>);
export const IconChevronRight = () => (<I size={20}><path d="m9 18 6-6-6-6" /></I>);
export const IconDownload = () => (<I size={18}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" /><path d="M12 15V3" /></I>);
export const IconWallet = () => (<I><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></I>);
export const IconAlert = () => (<I size={16}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></I>);
export const IconTrend = () => (<I size={18}><path d="m22 7-8.5 8.5-5-5L2 17" /><path d="M16 7h6v6" /></I>);
export const IconPiggy = () => (<I><path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 1 3 2 4V18a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1h5v1a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-3.3c1-.6 2-1.7 2-3.2 0-.4-.1-.8-.2-1.2C21 9.6 20 5 19 5Z" /><path d="M2 9v1c0 1.1.9 2 2 2h1" /><path d="M16 11h.01" /></I>);
export const IconLandmark = () => (<I><path d="M3 22h18" /><path d="M6 18v-7M10 18v-7M14 18v-7M18 18v-7" /><path d="m12 2 9 5H3z" /></I>);
export const IconScale = () => (<I><path d="M12 3v18" /><path d="M5 7h14" /><path d="m5 7-3 6a3.5 3.5 0 0 0 6 0L5 7Z" /><path d="m19 7-3 6a3.5 3.5 0 0 0 6 0l-3-6Z" /><path d="M8 21h8" /></I>);
export const IconArrowSwap = () => (<I><path d="M8 3 4 7l4 4" /><path d="M4 7h16" /><path d="m16 21 4-4-4-4" /><path d="M20 17H4" /></I>);
export const IconFile = () => (<I><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M8 13h8M8 17h5" /></I>);
export const IconDots = () => (<I><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></I>);
