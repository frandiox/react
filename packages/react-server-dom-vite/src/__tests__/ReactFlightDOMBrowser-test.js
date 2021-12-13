/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @emails react-core
 */

'use strict';

// Polyfills for test environment
global.ReadableStream = require('web-streams-polyfill/ponyfill/es6').ReadableStream;
global.TextEncoder = require('util').TextEncoder;
global.TextDecoder = require('util').TextDecoder;

let viteModuleIdx = 0;
let viteModules = {};

let act;
let React;
let ReactDOM;
let ReactServerDOMWriter;
let ReactServerDOMReader;

describe('ReactFlightDOMBrowser', () => {
  beforeEach(() => {
    jest.resetModules();
    viteModules = {};
    act = require('jest-react').act;
    React = require('react');
    ReactDOM = require('react-dom');
    ReactServerDOMWriter = require('react-server-dom-vite/writer.browser.server');
    ReactServerDOMReader = require('react-server-dom-vite');

    // Reset modules
    viteModules = global.allClientComponents;
    Object.keys(viteModules).forEach(key => delete viteModules[key]);
  });

  function moduleReference(moduleExport) {
    const idx = viteModuleIdx++;
    viteModules[idx] = () =>
      Promise.resolve({
        default: moduleExport,
      });

    const MODULE_TAG = Symbol.for('react.module.reference');
    return {$$typeof: MODULE_TAG, filepath: idx, name: 'default'};
  }

  async function waitForSuspense(fn) {
    while (true) {
      try {
        return fn();
      } catch (promise) {
        if (typeof promise.then === 'function') {
          await promise;
        } else {
          throw promise;
        }
      }
    }
  }

  it('should resolve HTML using W3C streams', async () => {
    function Text({children}) {
      return <span>{children}</span>;
    }
    function HTML() {
      return (
        <div>
          <Text>hello</Text>
          <Text>world</Text>
        </div>
      );
    }

    function App() {
      const model = {
        html: <HTML />,
      };
      return model;
    }

    const stream = ReactServerDOMWriter.renderToReadableStream(<App />);
    const response = ReactServerDOMReader.createFromReadableStream(stream);
    await waitForSuspense(() => {
      const model = response.readRoot();
      expect(model).toEqual({
        html: (
          <div>
            <span>hello</span>
            <span>world</span>
          </div>
        ),
      });
    });
  });

  it('should resolve HTML using W3C streams', async () => {
    function Text({children}) {
      return <span>{children}</span>;
    }
    function HTML() {
      return (
        <div>
          <Text>hello</Text>
          <Text>world</Text>
        </div>
      );
    }

    function App() {
      const model = {
        html: <HTML />,
      };
      return model;
    }

    const stream = ReactServerDOMWriter.renderToReadableStream(<App />);
    const response = ReactServerDOMReader.createFromReadableStream(stream);
    await waitForSuspense(() => {
      const model = response.readRoot();
      expect(model).toEqual({
        html: (
          <div>
            <span>hello</span>
            <span>world</span>
          </div>
        ),
      });
    });
  });

  it('should progressively reveal server components', async () => {
    let reportedErrors = [];
    const {Suspense} = React;

    // Client Components

    class ErrorBoundary extends React.Component {
      state = {hasError: false, error: null};
      static getDerivedStateFromError(error) {
        return {
          hasError: true,
          error,
        };
      }
      render() {
        if (this.state.hasError) {
          return this.props.fallback(this.state.error);
        }
        return this.props.children;
      }
    }

    function MyErrorBoundary({children}) {
      return (
        <ErrorBoundary fallback={e => <p>{e.message}</p>}>
          {children}
        </ErrorBoundary>
      );
    }

    // Model
    function Text({children}) {
      return children;
    }

    function makeDelayedText() {
      let error, _resolve, _reject;
      let promise = new Promise((resolve, reject) => {
        _resolve = () => {
          promise = null;
          resolve();
        };
        _reject = e => {
          error = e;
          promise = null;
          reject(e);
        };
      });
      function DelayedText({children}, data) {
        if (promise) {
          throw promise;
        }
        if (error) {
          throw error;
        }
        return <Text>{children}</Text>;
      }
      return [DelayedText, _resolve, _reject];
    }

    const [Friends, resolveFriends] = makeDelayedText();
    const [Name, resolveName] = makeDelayedText();
    const [Posts, resolvePosts] = makeDelayedText();
    const [Photos, resolvePhotos] = makeDelayedText();
    const [Games, , rejectGames] = makeDelayedText();

    // View
    function ProfileDetails({avatar}) {
      return (
        <div>
          <Name>:name:</Name>
          {avatar}
        </div>
      );
    }
    function ProfileSidebar({friends}) {
      return (
        <div>
          <Photos>:photos:</Photos>
          {friends}
        </div>
      );
    }
    function ProfilePosts({posts}) {
      return <div>{posts}</div>;
    }
    function ProfileGames({games}) {
      return <div>{games}</div>;
    }

    const MyErrorBoundaryClient = moduleReference(MyErrorBoundary);

    function ProfileContent() {
      return (
        <>
          <ProfileDetails avatar={<Text>:avatar:</Text>} />
          <Suspense fallback={<p>(loading sidebar)</p>}>
            <ProfileSidebar friends={<Friends>:friends:</Friends>} />
          </Suspense>
          <Suspense fallback={<p>(loading posts)</p>}>
            <ProfilePosts posts={<Posts>:posts:</Posts>} />
          </Suspense>
          <MyErrorBoundaryClient>
            <Suspense fallback={<p>(loading games)</p>}>
              <ProfileGames games={<Games>:games:</Games>} />
            </Suspense>
          </MyErrorBoundaryClient>
        </>
      );
    }

    const model = {
      rootContent: <ProfileContent />,
    };

    function ProfilePage({response}) {
      return response.readRoot().rootContent;
    }

    const stream = ReactServerDOMWriter.renderToReadableStream(model, {
      onError(x) {
        reportedErrors.push(x);
      },
    });
    const response = ReactServerDOMReader.createFromReadableStream(stream);

    const container = document.createElement('div');
    const root = ReactDOM.createRoot(container);
    await act(async () => {
      root.render(
        <Suspense fallback={<p>(loading)</p>}>
          <ProfilePage response={response} />
        </Suspense>,
      );
    });
    expect(container.innerHTML).toBe('<p>(loading)</p>');

    // This isn't enough to show anything.
    await act(async () => {
      resolveFriends();
    });
    expect(container.innerHTML).toBe('<p>(loading)</p>');

    // We can now show the details. Sidebar and posts are still loading.
    await act(async () => {
      resolveName();
    });
    // Advance time enough to trigger a nested fallback.
    jest.advanceTimersByTime(500);
    expect(container.innerHTML).toBe(
      '<div>:name::avatar:</div>' +
        '<p>(loading sidebar)</p>' +
        '<p>(loading posts)</p>' +
        '<p>(loading games)</p>',
    );

    expect(reportedErrors).toEqual([]);

    const theError = new Error('Game over');
    // Let's *fail* loading games.
    await act(async () => {
      rejectGames(theError);
    });
    expect(container.innerHTML).toBe(
      '<div>:name::avatar:</div>' +
        '<p>(loading sidebar)</p>' +
        '<p>(loading posts)</p>' +
        '<p>Game over</p>', // TODO: should not have message in prod.
    );

    expect(reportedErrors).toEqual([theError]);
    reportedErrors = [];

    // We can now show the sidebar.
    await act(async () => {
      resolvePhotos();
    });
    expect(container.innerHTML).toBe(
      '<div>:name::avatar:</div>' +
        '<div>:photos::friends:</div>' +
        '<p>(loading posts)</p>' +
        '<p>Game over</p>', // TODO: should not have message in prod.
    );

    // Show everything.
    await act(async () => {
      resolvePosts();
    });
    expect(container.innerHTML).toBe(
      '<div>:name::avatar:</div>' +
        '<div>:photos::friends:</div>' +
        '<div>:posts:</div>' +
        '<p>Game over</p>', // TODO: should not have message in prod.
    );

    expect(reportedErrors).toEqual([]);
  });
});