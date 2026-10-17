// Safari on iPhone colours the area under its status bar and toolbar from a
// fixed layer at that edge of the screen. WebKit hit-tests a point 4px in from
// each edge and skips layers 10px tall or less, so a 12px strip of the page
// colour at each edge makes the browser chrome read as part of the page.
// After https://joshpuckett.me/seamless-mobile-safari.
//
// Real fixed elements rather than ::after, because WebKit reads the hit
// element's own box and its ancestors, and they sit outside any transformed
// ancestor so they stay pinned to the screen.
//
// Turn an edge off where content should run under the browser chrome, as the
// onboarding's drum does under the toolbar: Safari can only extend a solid
// colour there, never the content itself.
export function SafariEdges({ top = true, bottom = true }: { top?: boolean; bottom?: boolean }) {
  return (
    <>
      {top && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[max(12px,var(--safe-top,env(safe-area-inset-top)))] bg-neutral-950"
        />
      )}
      {bottom && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] h-[max(12px,var(--safe-bottom,env(safe-area-inset-bottom)))] bg-neutral-950"
        />
      )}
    </>
  )
}
