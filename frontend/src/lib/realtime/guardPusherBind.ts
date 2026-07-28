/**
 * Emergency runtime guard for Pusher/Echo channel `.bind()` crashes.
 *
 * Some deployments may initialize subscriptions before Echo/Pusher finishes wiring
 * internal callbacks. In that case, pusher-js can throw:
 *   TypeError: Cannot read properties of undefined (reading 'callbacks')
 *
 * This guard prevents the UI from crashing and logs a small debug payload.
 */

let installed = false;

type BindablePrototype = {
  bind?: (...args: unknown[]) => unknown;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasCallbacks(thisValue: unknown): boolean {
  if (!isObject(thisValue)) return false;
  return "callbacks" in thisValue && Boolean(thisValue.callbacks);
}

export function installPusherBindGuard() {
  if (installed) return;
  installed = true;

  if (typeof window === "undefined") return;

  const w = window as unknown as {
    Echo?: unknown;
    Pusher?: unknown;
  };

  // pusher-js may expose constructor on window.Pusher; we patch best-effort.
  const pusher = w.Pusher as
    | undefined
    | {
        Channel?: { prototype?: BindablePrototype };
        _EventDispatcher?: { prototype?: BindablePrototype };
        EventDispatcher?: { prototype?: BindablePrototype };
      };

  const prototypes: Array<BindablePrototype | undefined> = [
    pusher?.Channel?.prototype,
    pusher?._EventDispatcher?.prototype,
    pusher?.EventDispatcher?.prototype,
  ];

  const patchPrototype = (proto: BindablePrototype | undefined) => {
    if (!proto?.bind) return;

    const originalBind = proto.bind;

    // eslint-disable-next-line func-names
    (proto as BindablePrototype).bind = function guardBind(...args: unknown[]) {
      try {
        if (!hasCallbacks(this)) {
          const eventName = args[0];

          // eslint-disable-next-line no-console
          console.log("PUSHER/ECHO DEBUG (guard): bind target missing callbacks", {
            eventName,
            hasWindowEcho: Boolean((w as unknown as { Echo?: unknown }).Echo),
            thisType: typeof this,
          });

          // Swallow to avoid crash.
          return this;
        }
      } catch {
        // swallow
      }

      return originalBind(...args);
    };
  };

  prototypes.forEach((proto) => patchPrototype(proto));
}
