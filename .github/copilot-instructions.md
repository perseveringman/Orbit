# Orbit Copilot instructions

## UI stack

- For DOM-based UI work in this repository, default to **HeroUI v3**.
- This applies to `apps/web`, `apps/desktop`, and shared DOM-oriented UI packages. It does not apply to iOS native UI.
- Use `@heroui/react` and `@heroui/styles`. Do not introduce NextUI or HeroUI v2 patterns.
- HeroUI v3 requires **React 19** and **Tailwind CSS v4**.
- Keep stylesheet import order as:
  1. `@import "tailwindcss";`
  2. `@import "@heroui/styles";`
- Do not add `HeroUIProvider`; HeroUI v3 does not require it.
- Keep theme state synchronized on the root `html` element with both `class="light|dark"` and `data-theme="light|dark"`.

## Working with HeroUI

- Before introducing or changing a HeroUI component, use the repository skill at `.github/skills/heroui-react`.
- Prefer official HeroUI v3 docs/examples over memory.
- Prefer semantic variants and accessibility-friendly handlers such as `onPress` when HeroUI components support them.
