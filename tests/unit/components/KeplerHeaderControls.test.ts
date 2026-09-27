import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { KeplerHeaderControls } from '../../../client/src/components/kepler/KeplerHeaderControls';

describe('KeplerHeaderControls', () => {
  it('renders layers and filters buttons with inactive states', () => {
    const setShowMenu = jest.fn();
    const setShowFilters = jest.fn();

    const html = renderToStaticMarkup(
      React.createElement(KeplerHeaderControls, {
        showMenu: false,
        setShowMenu,
        showFilters: false,
        setShowFilters,
      })
    );

    expect(html).toContain('aria-label="Open layers"');
    expect(html).toContain('title="Layers"');
    expect(html).toContain('aria-label="Toggle filters"');
    expect(html).toContain('title="Toggle filters"');
  });

  it('renders active states for layers and filters', () => {
    const setShowMenu = jest.fn();
    const setShowFilters = jest.fn();

    const html = renderToStaticMarkup(
      React.createElement(KeplerHeaderControls, {
        showMenu: true,
        setShowMenu,
        showFilters: true,
        setShowFilters,
      })
    );

    expect(html).toContain('aria-label="Close layers"');
    expect(html).toContain('background:rgba(59,130,246,0.15)');
    expect(html).toContain('background:rgba(59,130,246,0.16)');
    expect(html).toContain('box-shadow:0 6px 20px rgba(59,130,246,0.08)');
  });

  it('triggers setShowMenu and setShowFilters on click', () => {
    const setShowMenu = jest.fn();
    const setShowFilters = jest.fn();

    const element = KeplerHeaderControls({
      showMenu: false,
      setShowMenu,
      showFilters: false,
      setShowFilters,
    });

    const [layersButton, filtersButton] = (element as React.ReactElement<any>).props.children;

    layersButton.props.onClick();
    expect(setShowMenu).toHaveBeenCalledTimes(1);
    expect(setShowMenu).toHaveBeenCalledWith(true);

    filtersButton.props.onClick();
    expect(setShowFilters).toHaveBeenCalledTimes(1);
    expect(setShowFilters).toHaveBeenCalledWith(true);
  });
});
