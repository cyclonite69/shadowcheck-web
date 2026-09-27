import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MapToolbarNav } from '../../../client/src/components/geospatial/toolbar/MapToolbarNav';
import { MapToolbar } from '../../../client/src/components/geospatial/toolbar/MapToolbar';

const mockExecLogout = jest.fn((callback?: () => void) => {
  callback?.();
  return Promise.resolve();
});

jest.mock('../../../client/src/hooks/useLogout', () => ({
  useLogout: () => ({
    loggingOut: false,
    handleLogout: mockExecLogout,
  }),
}));

describe('MapToolbarNav and Header Label', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders closed burger when navOpen is false and does not render nav links', () => {
    const setNavOpen = jest.fn();
    const markup = renderToStaticMarkup(
      React.createElement(MapToolbarNav, {
        navOpen: false,
        setNavOpen,
        navRef: { current: null },
      })
    );

    expect(markup).toContain('≡');
    expect(markup).not.toContain('Dashboard');
    expect(markup).not.toContain('Logout');
  });

  it('renders sidebar navigation with pages and Logout button when navOpen is true', () => {
    const setNavOpen = jest.fn();
    const markup = renderToStaticMarkup(
      React.createElement(MapToolbarNav, {
        navOpen: true,
        setNavOpen,
        navRef: { current: null },
      })
    );

    expect(markup).toContain('✕');
    expect(markup).toContain('Dashboard');
    expect(markup).toContain('Geospatial Explorer');
    expect(markup).toContain('aria-label="Log out"');
    expect(markup).toContain('Logout');
  });

  it('triggers logout and closes sidebar on logout click', async () => {
    mockExecLogout.mockImplementation(async (callback?: () => void) => {
      callback?.();
    });

    const setNavOpen = jest.fn();
    const element = MapToolbarNav({
      navOpen: true,
      setNavOpen,
      navRef: { current: null },
    });

    // The nav is the second child of the root container
    const navElement = (element as React.ReactElement<any>).props.children[1];
    // Find the button with aria-label="Log out"
    const navChildren = React.Children.toArray(navElement.props.children);
    const logoutBtn = navChildren.find(
      (child: any) => child && child.props && child.props['aria-label'] === 'Log out'
    ) as React.ReactElement<any>;

    expect(logoutBtn).toBeDefined();

    // Trigger onClick
    await logoutBtn.props.onClick();

    expect(mockExecLogout).toHaveBeenCalledTimes(1);
    expect(setNavOpen).toHaveBeenCalledWith(false);
  });

  it('renders header label as "ShadowCheck Geospatial" by default in MapToolbar', () => {
    const markup = renderToStaticMarkup(
      React.createElement(MapToolbar, {
        locationSearch: '',
        onLocationSearchChange: jest.fn(),
        onLocationSearchFocus: jest.fn(),
        searchingLocation: false,
        showSearchResults: false,
        searchResults: [],
        onSelectSearchResult: jest.fn(),
        mapStyle: 'dark',
        onMapStyleChange: jest.fn(),
        mapStyles: [{ label: 'Dark', value: 'dark' }],
        show3DBuildings: false,
        is3DBuildingsAvailable: false,
        onToggle3DBuildings: jest.fn(),
        showTerrain: false,
        onToggleTerrain: jest.fn(),
        canFit: false,
        fitButtonActive: false,
        onFit: jest.fn(),
        homeButtonActive: false,
        onHome: jest.fn(),
        onGps: jest.fn(),
      })
    );

    expect(markup).toContain('Shadow<span style="color:#60a5fa">Check</span>');
    expect(markup).toContain('<span style="color:#60a5fa">Geospatial</span>');
  });
});
