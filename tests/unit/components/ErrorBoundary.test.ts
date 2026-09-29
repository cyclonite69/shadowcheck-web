import React, { act, useEffect } from 'react';
import { createRoot, Root } from 'react-dom/client';
import path from 'path';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';

// Load JSDOM via native Node module loader to bypass Jest ESM restriction on @exodus/bytes
const mod = require('module');
const jsdomPath = path.resolve(__dirname, '../../../node_modules/jsdom');
const { JSDOM } = mod._load(jsdomPath, null, false);

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost',
});

// Configure DOM globals
(global as any).window = dom.window;
(global as any).document = dom.window.document;
(global as any).HTMLElement = dom.window.HTMLElement;
(global as any).Node = dom.window.Node;
(global as any).MouseEvent = dom.window.MouseEvent;
(global as any).Event = dom.window.Event;
(global as any).IS_REACT_ACT_ENVIRONMENT = true;

// Mock clientLogger to prevent import.meta.env failure in Jest and allow call tracking
const mockLogError = jest.fn();
jest.mock('../../../client/src/logging/clientLogger', () => ({
  logError: (...args: unknown[]) => mockLogError(...args),
  logWarn: jest.fn(),
  logInfo: jest.fn(),
  logDebug: jest.fn(),
}));

const { RouteErrorBoundary } = require('../../../client/src/components/ErrorBoundary');

function BadRouteA() {
  useEffect(() => {
    return () => {
      throw new Error('Simulated map cleanup throw');
    };
  }, []);
  return React.createElement('div', { id: 'route-a' }, 'Route A Content');
}

function GoodRouteB() {
  return React.createElement('div', { id: 'route-b' }, 'Route B Content');
}

function GoodRouteC() {
  return React.createElement('div', { id: 'route-c' }, 'Route C Content');
}

function RenderCrashRoute(): React.ReactNode {
  throw new Error('Render crash error');
}

function Handled401CrashRoute(): React.ReactNode {
  const err = new Error('401 handled');
  (err as any).handled = true;
  throw err;
}

let triggerNav: ((path: string) => void) | null = null;

function NavBridge() {
  const navigate = useNavigate();
  triggerNav = navigate;
  return null;
}

function TestShell({ children }: { children?: React.ReactNode }) {
  return React.createElement(
    'div',
    { id: 'app-shell' },
    React.createElement('nav', { id: 'test-nav' }, 'Global Navigation Bar'),
    React.createElement(NavBridge, null),
    React.createElement('main', { id: 'main-content' }, children)
  );
}

describe('RouteErrorBoundary', () => {
  let container: HTMLDivElement;
  let root: Root;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    mockLogError.mockClear();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    triggerNav = null;
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    consoleErrorSpy.mockRestore();
  });

  it('1. Stable boundary catches an outgoing-route cleanup throw on A -> B, and renders fallback with app shell intact', async () => {
    await act(async () => {
      root.render(
        React.createElement(
          MemoryRouter,
          { initialEntries: ['/a'] },
          React.createElement(
            TestShell,
            null,
            React.createElement(
              RouteErrorBoundary,
              null,
              React.createElement(
                Routes,
                null,
                React.createElement(Route, {
                  path: '/a',
                  element: React.createElement(BadRouteA, null),
                }),
                React.createElement(Route, {
                  path: '/b',
                  element: React.createElement(GoodRouteB, null),
                })
              )
            )
          )
        )
      );
    });

    expect(container.querySelector('#route-a')?.textContent).toBe('Route A Content');
    expect(container.querySelector('#test-nav')?.textContent).toBe('Global Navigation Bar');

    // Navigate A -> B (triggering unmount cleanup throw in BadRouteA)
    await act(async () => {
      triggerNav?.('/b');
    });

    // App shell / nav must remain intact
    expect(container.querySelector('#test-nav')).not.toBeNull();
    expect(container.querySelector('#test-nav')?.textContent).toBe('Global Navigation Bar');

    // Fallback must render and contain error info, persisting at /b
    const fallback = container.querySelector('[data-testid="route-error-fallback"]');
    expect(fallback).not.toBeNull();
    expect(fallback?.textContent).toContain('Something went wrong');
    expect(fallback?.textContent).toContain('Simulated map cleanup throw');

    // Action buttons must be present
    const buttons = Array.from(fallback?.querySelectorAll('button') ?? []);
    const buttonTexts = buttons.map((b) => b.textContent?.trim());
    expect(buttonTexts).toContain('Try again');
    expect(buttonTexts).toContain('Reload page');

    const links = Array.from(fallback?.querySelectorAll('a') ?? []);
    expect(links.some((a) => a.getAttribute('href') === '/dashboard')).toBe(true);

    // Boundary's logger must have fired once for this unhandled error
    expect(mockLogError).toHaveBeenCalledTimes(1);
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringContaining('[ErrorBoundary]'),
      expect.objectContaining({
        error: expect.objectContaining({ message: 'Simulated map cleanup throw' }),
      })
    );
  });

  it('2. "Try again" clears the error and renders the current route healthy', async () => {
    await act(async () => {
      root.render(
        React.createElement(
          MemoryRouter,
          { initialEntries: ['/a'] },
          React.createElement(
            TestShell,
            null,
            React.createElement(
              RouteErrorBoundary,
              null,
              React.createElement(
                Routes,
                null,
                React.createElement(Route, {
                  path: '/a',
                  element: React.createElement(BadRouteA, null),
                }),
                React.createElement(Route, {
                  path: '/b',
                  element: React.createElement(GoodRouteB, null),
                })
              )
            )
          )
        )
      );
    });

    // Navigate A -> B (triggers cleanup throw)
    await act(async () => {
      triggerNav?.('/b');
    });

    expect(container.querySelector('[data-testid="route-error-fallback"]')).not.toBeNull();
    expect(container.querySelector('#route-b')).toBeNull();

    // Click "Try again" button
    const tryAgainBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Try again'
    );
    expect(tryAgainBtn).toBeDefined();

    await act(async () => {
      tryAgainBtn?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    });

    // Fallback is gone, and route B is rendered healthy
    expect(container.querySelector('[data-testid="route-error-fallback"]')).toBeNull();
    expect(container.querySelector('#route-b')?.textContent).toBe('Route B Content');
  });

  it('3. A later navigation from the fallback to a healthy route resets the boundary automatically', async () => {
    await act(async () => {
      root.render(
        React.createElement(
          MemoryRouter,
          { initialEntries: ['/a'] },
          React.createElement(
            TestShell,
            null,
            React.createElement(
              RouteErrorBoundary,
              null,
              React.createElement(
                Routes,
                null,
                React.createElement(Route, {
                  path: '/a',
                  element: React.createElement(BadRouteA, null),
                }),
                React.createElement(Route, {
                  path: '/b',
                  element: React.createElement(GoodRouteB, null),
                }),
                React.createElement(Route, {
                  path: '/c',
                  element: React.createElement(GoodRouteC, null),
                })
              )
            )
          )
        )
      );
    });

    // Navigate A -> B (cleanup throw)
    await act(async () => {
      triggerNav?.('/b');
    });

    expect(container.querySelector('[data-testid="route-error-fallback"]')).not.toBeNull();

    // Later navigation B -> C
    await act(async () => {
      triggerNav?.('/c');
    });

    // Boundary automatically resets on navigation away from error path
    expect(container.querySelector('[data-testid="route-error-fallback"]')).toBeNull();
    expect(container.querySelector('#route-c')?.textContent).toBe('Route C Content');
  });

  it('4. The handled 401 sentinel renders null, no fallback card, and no boundary log', async () => {
    await act(async () => {
      root.render(
        React.createElement(
          MemoryRouter,
          { initialEntries: ['/401'] },
          React.createElement(
            TestShell,
            null,
            React.createElement(
              RouteErrorBoundary,
              null,
              React.createElement(
                Routes,
                null,
                React.createElement(Route, {
                  path: '/401',
                  element: React.createElement(Handled401CrashRoute, null),
                })
              )
            )
          )
        )
      );
    });

    // Shell intact
    expect(container.querySelector('#test-nav')).not.toBeNull();
    // Handled 401 renders null: no fallback card is displayed
    expect(container.querySelector('[data-testid="route-error-fallback"]')).toBeNull();
    // Logging was skipped for the handled 401 sentinel
    expect(mockLogError).not.toHaveBeenCalled();
  });

  it('5. A render-time error at an unchanged pathname does not auto-reset until pathname changes', async () => {
    await act(async () => {
      root.render(
        React.createElement(
          MemoryRouter,
          { initialEntries: ['/crash'] },
          React.createElement(
            TestShell,
            null,
            React.createElement(
              RouteErrorBoundary,
              null,
              React.createElement(
                Routes,
                null,
                React.createElement(Route, {
                  path: '/crash',
                  element: React.createElement(RenderCrashRoute, null),
                }),
                React.createElement(Route, {
                  path: '/b',
                  element: React.createElement(GoodRouteB, null),
                })
              )
            )
          )
        )
      );
    });

    expect(container.querySelector('[data-testid="route-error-fallback"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="route-error-fallback"]')?.textContent).toContain(
      'Render crash error'
    );

    // Navigating to the same pathname does not auto-reset
    await act(async () => {
      triggerNav?.('/crash');
    });

    expect(container.querySelector('[data-testid="route-error-fallback"]')).not.toBeNull();

    // Navigating to a new route /b auto-resets
    await act(async () => {
      triggerNav?.('/b');
    });

    expect(container.querySelector('[data-testid="route-error-fallback"]')).toBeNull();
    expect(container.querySelector('#route-b')?.textContent).toBe('Route B Content');
  });

  it('6. Navigates from healthy route A to route B whose own render throws: fallback persists, does not loop, and logs exactly once', async () => {
    await act(async () => {
      root.render(
        React.createElement(
          MemoryRouter,
          { initialEntries: ['/good'] },
          React.createElement(
            TestShell,
            null,
            React.createElement(
              RouteErrorBoundary,
              null,
              React.createElement(
                Routes,
                null,
                React.createElement(Route, {
                  path: '/good',
                  element: React.createElement('div', { id: 'healthy-a' }, 'Healthy Route A'),
                }),
                React.createElement(Route, {
                  path: '/render-crash',
                  element: React.createElement(RenderCrashRoute, null),
                })
              )
            )
          )
        )
      );
    });

    expect(container.querySelector('#healthy-a')?.textContent).toBe('Healthy Route A');
    expect(mockLogError).not.toHaveBeenCalled();

    // Navigate from healthy A to render-crash B
    await act(async () => {
      triggerNav?.('/render-crash');
    });

    // Fallback must persist and nav bar remain intact
    expect(container.querySelector('#test-nav')).not.toBeNull();
    const fallback = container.querySelector('[data-testid="route-error-fallback"]');
    expect(fallback).not.toBeNull();
    expect(fallback?.textContent).toContain('Render crash error');

    // Must log exactly once (no render looping or reset-crash cycling)
    expect(mockLogError).toHaveBeenCalledTimes(1);
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringContaining('[ErrorBoundary]'),
      expect.objectContaining({
        error: expect.objectContaining({ message: 'Render crash error' }),
      })
    );
  });
});
