// Mobile Tilt/Gyroscope Controls (Android & iOS), Calibration, Orientation Guard, Touch & Keyboard

import { clamp } from './math.js';

export class ControlManager {
  constructor(settings) {
    this.settings = settings;

    // Logical outputs consumed by physics
    this.steer = 0;         // -1 (left) .. +1 (right)
    this.throttle = 0;      // 0 .. 1
    this.brake = 0;         // 0 .. 1
    this.handbrake = false;
    this.nitro = false;

    // Raw inputs
    this.keys = {
      up: false, down: false, left: false, right: false,
      handbrake: false, nitro: false
    };
    this.touch = {
      gas: false, screenGas: false, brake: false, left: false, right: false,
      handbrake: false, nitro: false
    };

    // Sensor / Gyroscope state
    this.sensorAvailable = false;
    this.sensorActive = false;
    this.needsIOSPermission = (
      typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function'
    );
    this.permissionGranted = !this.needsIOSPermission;
    this.rawTiltDeg = 0;          // Signed horizontal tilt degrees before calibration
    this.calibratedDeg = 0;       // Degrees relative to center
    this.smoothedTiltSteer = 0;   // Low-pass filtered tilt steering (-1..1)
    this.smoothedKeySteer = 0;    // Smoothed digital steering (-1..1)
    this.screenAngle = this.getScreenAngle();
    this.isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    this.isLandscape = window.innerWidth >= window.innerHeight;
    this.onOrientationChange = null;

    this._boundOrientation = (e) => this._handleDeviceOrientation(e);
    this._boundKeyDown = (e) => this._handleKey(e, true);
    this._boundKeyUp = (e) => this._handleKey(e, false);
    this._boundResize = () => this._handleViewportChange();

    this.attach();
  }

  attach() {
    window.addEventListener('keydown', this._boundKeyDown, { passive: false });
    window.addEventListener('keyup', this._boundKeyUp);
    window.addEventListener('resize', this._boundResize);
    window.addEventListener('orientationchange', this._boundResize);
    if (screen.orientation && screen.orientation.addEventListener) {
      screen.orientation.addEventListener('change', this._boundResize);
    }
    window.addEventListener('blur', () => this.resetInputs());

    if (!this.needsIOSPermission && typeof window.DeviceOrientationEvent !== 'undefined') {
      window.addEventListener('deviceorientation', this._boundOrientation, true);
    }
  }

  getScreenAngle() {
    if (screen.orientation && typeof screen.orientation.angle === 'number') {
      return screen.orientation.angle;
    }
    if (typeof window.orientation === 'number') {
      return window.orientation;
    }
    return window.innerWidth >= window.innerHeight ? 90 : 0;
  }

  _handleViewportChange() {
    this.screenAngle = this.getScreenAngle();
    this.isLandscape = window.innerWidth >= window.innerHeight;
    if (this.onOrientationChange) {
      this.onOrientationChange(this.isLandscape, this.screenAngle);
    }
  }

  isFullscreen() {
    return !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );
  }

  async requestLandscapeLock() {
    let fsOk = false;
    try {
      const el = document.documentElement;
      const req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
      if (req && !this.isFullscreen()) {
        await Promise.resolve(req.call(el)).then(() => { fsOk = true; }).catch(() => {});
      } else if (this.isFullscreen()) {
        fsOk = true;
      }
      if (screen.orientation && screen.orientation.lock) {
        await screen.orientation.lock('landscape').catch(() => {});
      }
    } catch {}
    return fsOk;
  }

  async toggleFullscreen() {
    try {
      if (this.isFullscreen()) {
        const exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
        if (exit) await Promise.resolve(exit.call(document)).catch(() => {});
        return { ok: true, active: false };
      }
      const ok = await this.requestLandscapeLock();
      return { ok, active: ok || this.isFullscreen() };
    } catch {
      return { ok: false, active: false };
    }
  }

  async requestSensorPermission() {
    if (typeof DeviceOrientationEvent === 'undefined') {
      return { ok: false, reason: 'unsupported' };
    }
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const res = await DeviceOrientationEvent.requestPermission();
        if (res === 'granted') {
          this.permissionGranted = true;
          window.addEventListener('deviceorientation', this._boundOrientation, true);
          return { ok: true };
        }
        return { ok: false, reason: 'denied' };
      } catch {
        return { ok: false, reason: 'error' };
      }
    } else {
      this.permissionGranted = true;
      window.addEventListener('deviceorientation', this._boundOrientation, true);
      return { ok: true };
    }
  }

  // Computes landscape steering tilt angle in degrees (+ = right, - = left)
  _handleDeviceOrientation(event) {
    if (event.beta === null && event.gamma === null) return;

    this.sensorAvailable = true;
    const angle = this.getScreenAngle();
    let tilt = 0;

    // In Landscape mode on smartphones:
    // - Rotating phone like a steering wheel (left hand down / right hand up) changes BETA.
    // - At angle 90 (landscape-primary, USB port right): tilting right -> beta > 0, tilting left -> beta < 0.
    // - At angle 270 or -90 (landscape-secondary, USB port left): sign is reversed.
    if (angle === 90) {
      tilt = event.beta || 0;
    } else if (angle === 270 || angle === -90) {
      tilt = -(event.beta || 0);
    } else {
      // Fallback (portrait / desktop emulator using gamma)
      tilt = event.gamma || 0;
    }

    if (this.settings.tiltInvert) tilt = -tilt;
    this.rawTiltDeg = tilt;
    this.sensorActive = true;
  }

  // Test helper / external injection for automated tests
  simulateTilt(betaDeg, screenAngle = 90) {
    this.screenAngle = screenAngle;
    this.sensorAvailable = true;
    this.sensorActive = true;
    let tilt = screenAngle === 90 ? betaDeg : (screenAngle === 270 || screenAngle === -90 ? -betaDeg : betaDeg);
    if (this.settings.tiltInvert) tilt = -tilt;
    this.rawTiltDeg = tilt;
  }

  calibrateCenter() {
    this.settings.tiltCenter = this.rawTiltDeg;
    return this.settings.tiltCenter;
  }

  resetCalibration() {
    this.settings.tiltCenter = 0;
  }

  useTiltSteering() {
    const mode = this.settings.controlMode;
    if (mode === 'buttons') return false;
    if (mode === 'tilt') return this.sensorActive || this.isTouchDevice;
    // 'auto': use tilt if sensor is actively reporting on touch/mobile
    return this.sensorActive;
  }

  _handleKey(e, pressed) {
    const c = e.code;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(c)) {
      e.preventDefault();
    }
    if (c === 'KeyW' || c === 'ArrowUp') this.keys.up = pressed;
    if (c === 'KeyS' || c === 'ArrowDown') this.keys.down = pressed;
    if (c === 'KeyA' || c === 'ArrowLeft') this.keys.left = pressed;
    if (c === 'KeyD' || c === 'ArrowRight') this.keys.right = pressed;
    if (c === 'Space') this.keys.handbrake = pressed;
    if (c === 'ShiftLeft' || c === 'ShiftRight') this.keys.nitro = pressed;
  }

  resetInputs() {
    this.keys.up = this.keys.down = this.keys.left = this.keys.right = false;
    this.keys.handbrake = this.keys.nitro = false;
    this.touch.gas = this.touch.screenGas = this.touch.brake = this.touch.left = this.touch.right = false;
    this.touch.handbrake = this.touch.nitro = false;
    this.smoothedKeySteer = 0;
  }

  setScreenGas(active) {
    this.touch.screenGas = !!active;
  }

  bindTouchButton(el, prop) {
    if (!el) return;
    const on = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.touch[prop] = true;
      el.classList.add('pressed');
    };
    const off = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.touch[prop] = false;
      el.classList.remove('pressed');
    };
    el.addEventListener('pointerdown', on, { passive: false });
    el.addEventListener('pointerup', off, { passive: false });
    el.addEventListener('pointercancel', off, { passive: false });
    el.addEventListener('pointerleave', off, { passive: false });
  }

  update(dt) {
    // 1. Compute calibrated tilt steering with deadzone, non-linear curve & low-pass smoothing
    const center = this.settings.tiltCenter || 0;
    const deadzone = clamp(this.settings.tiltDeadzone ?? 3.5, 0, 12);
    const sens = clamp(this.settings.tiltSensitivity ?? 1.35, 0.4, 2.8);

    const diff = this.rawTiltDeg - center;
    this.calibratedDeg = diff;

    let tiltTarget = 0;
    if (Math.abs(diff) > deadzone) {
      const sign = diff > 0 ? 1 : -1;
      const effective = Math.abs(diff) - deadzone;
      // 32 degrees full lock at sensitivity 1.0
      const norm = clamp((effective / 32) * sens, 0, 1);
      // Natural progressive curve (finer control near center, strong authority at deep angles)
      tiltTarget = sign * Math.pow(norm, 1.25);
    }

    // Exponential smoothing (natural, jitter-free steering)
    const tiltAlpha = 1 - Math.exp(-14 * dt);
    this.smoothedTiltSteer += (tiltTarget - this.smoothedTiltSteer) * tiltAlpha;

    // 2. Digital steering (keyboard + on-screen fallback buttons)
    const digitalRight = (this.keys.right || this.touch.right) ? 1 : 0;
    const digitalLeft = (this.keys.left || this.touch.left) ? 1 : 0;
    const digitalTarget = digitalRight - digitalLeft;
    const keyAlpha = 1 - Math.exp(-(digitalTarget === 0 ? 15 : 11) * dt);
    this.smoothedKeySteer += (digitalTarget - this.smoothedKeySteer) * keyAlpha;

    // Combine: digital overrides tilt if pressed; otherwise use tilt when active
    if (Math.abs(digitalTarget) > 0.01 || Math.abs(this.smoothedKeySteer) > 0.02) {
      this.steer = clamp(this.smoothedKeySteer, -1, 1);
    } else if (this.useTiltSteering()) {
      this.steer = clamp(this.smoothedTiltSteer, -1, 1);
    } else {
      this.steer = 0;
    }

    this.brake = (this.keys.down || this.touch.brake) ? 1 : 0;
    this.throttle = (this.keys.up || this.touch.gas || (this.touch.screenGas && !this.brake)) ? 1 : 0;
    this.handbrake = !!(this.keys.handbrake || this.touch.handbrake);
    this.nitro = !!(this.keys.nitro || this.touch.nitro);
  }
}
