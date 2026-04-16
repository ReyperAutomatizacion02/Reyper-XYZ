import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    darkMode: ["class", "class"],
    theme: {
        container: {
            center: true,
            padding: "2rem",
            screens: {
                "2xl": "1400px",
            },
        },
        extend: {
            colors: {
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                primary: {
                    DEFAULT: "hsl(var(--primary))",
                    foreground: "hsl(var(--primary-foreground))",
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary))",
                    foreground: "hsl(var(--secondary-foreground))",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent))",
                    foreground: "hsl(var(--accent-foreground))",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))",
                },
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },
                chart: {
                    "1": "hsl(var(--chart-1))",
                    "2": "hsl(var(--chart-2))",
                    "3": "hsl(var(--chart-3))",
                    "4": "hsl(var(--chart-4))",
                    "5": "hsl(var(--chart-5))",
                },
                "sidebar-bg": "hsl(var(--sidebar-bg))",
                "sidebar-hover": "hsl(var(--sidebar-hover))",
                "navbar-bg": "hsl(var(--navbar-bg))",
                "navbar-border": "hsl(var(--navbar-border))",
                brand: {
                    DEFAULT: "#EC1C21",
                    hover: "#D1181C",
                },
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
            },
            keyframes: {
                "accordion-down": {
                    from: {
                        height: "0",
                    },
                    to: {
                        height: "var(--radix-accordion-content-height)",
                    },
                },
                "accordion-up": {
                    from: {
                        height: "var(--radix-accordion-content-height)",
                    },
                    to: {
                        height: "0",
                    },
                },
            },
            animation: {
                "accordion-down": "accordion-down 0.2s ease-out",
                "accordion-up": "accordion-up 0.2s ease-out",
            },
            zIndex: {
                behind: "-1", // background canvas (app/page.tsx)
                "sub-panel": "15", // details-panel inner sidebar
                "gantt-col": "40", // gantt fixed left column
                "gantt-bar": "50", // gantt toolbar row
                dropdown: "100", // context menus, tooltips, sticky headers
                picker: "101", // time/date pickers nested in dropdowns
                "eval-panel": "999", // evaluation filter panel
                "eval-sidebar": "1000", // evaluation sidebar + single-step modals
                "filter-fly": "1500", // filter flyout panel
                "nav-backdrop": "9998", // mobile nav/date backdrop
                "nav-drawer": "9999", // mobile sidebar drawer + fullscreen canvas
                overlay: "10000", // dialog/modal backdrops
                modal: "10001", // dialog/modal content + inline popovers
                popover: "10002", // popovers and selects above modals
                "dialog-stack": "10003", // stacked alert dialogs
                "super-dropdown": "11000", // custom-dropdown highest layer
                saving: "20000", // saving overlay — top of everything
            },
        },
    },
    plugins: [require("tailwindcss-animate")],
};
export default config;
