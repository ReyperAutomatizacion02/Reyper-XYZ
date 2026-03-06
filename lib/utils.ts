import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isValidImageSrc(src: any): boolean {
  if (typeof src !== 'string' || !src) return false;
  return src.startsWith('http://') || src.startsWith('https://') || src.startsWith('/') || src.startsWith('data:');
}
