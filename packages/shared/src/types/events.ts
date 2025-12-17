/**
 * DOM Event Types captured by the extension
 */

export type DOMEventType = 'click' | 'scroll' | 'focus' | 'blur' | 'input' | 'keydown';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Viewport {
  width: number;
  height: number;
}

export interface ScrollPosition {
  x: number;
  y: number;
}

export interface ElementTarget {
  tag: string;
  id: string | null;
  classes: string[];
  text: string;
  selector: string;
  bbox: BoundingBox;
  attributes: Record<string, string>;
  // For input elements
  type?: string;
  name?: string;
  value?: string;
}

export interface EventMetadata {
  url: string;
  viewport: Viewport;
  scrollPosition?: ScrollPosition;
}

export interface BaseDOMEvent {
  type: DOMEventType;
  timestamp: number;
  metadata: EventMetadata;
}

export interface ClickEvent extends BaseDOMEvent {
  type: 'click';
  target: ElementTarget;
}

export interface ScrollEvent extends BaseDOMEvent {
  type: 'scroll';
  scrollPosition: ScrollPosition;
}

export interface FocusEvent extends BaseDOMEvent {
  type: 'focus';
  target: ElementTarget;
}

export interface BlurEvent extends BaseDOMEvent {
  type: 'blur';
  target: ElementTarget;
}

export interface InputEvent extends BaseDOMEvent {
  type: 'input';
  target: ElementTarget;
  inputValue: string;
}

export interface KeydownEvent extends BaseDOMEvent {
  type: 'keydown';
  key: string;
  code: string;
  modifiers: {
    ctrl: boolean;
    alt: boolean;
    shift: boolean;
    meta: boolean;
  };
}

export type DOMEvent = ClickEvent | ScrollEvent | FocusEvent | BlurEvent | InputEvent | KeydownEvent;
