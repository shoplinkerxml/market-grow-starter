import type { Config } from "tailwindcss";
import type { PluginCreator } from "tailwindcss/types/config";
import * as tailwindcssAnimateModule from "tailwindcss-animate";

const tailwindcssAnimate =
	((tailwindcssAnimateModule as unknown as { default?: PluginCreator }).default ??
		(tailwindcssAnimateModule as unknown as PluginCreator)) as PluginCreator;

export default {
    darkMode: ["class"],
    content: [
        "./pages/**/*.{ts,tsx}",
        "./components/**/*.{ts,tsx}",
        "./app/**/*.{ts,tsx}",
        "./src/**/*.{ts,tsx}",
    ],
    prefix: "",
    theme: {
    	container: {
    		center: true,
    		padding: '2rem',
    		screens: {
    			'2xl': '1400px'
    		}
    	},
    	screens: {
    		xs: '475px',
    		sm: '640px',
    		md: '768px',
    		lg: '1024px',
    		xl: '1280px',
    		'2xl': '1536px'
    	},
    	extend: {
    		colors: {
    			border: 'hsl(var(--border))',
    			input: 'hsl(var(--input))',
    			ring: 'hsl(var(--ring))',
    			background: 'hsl(var(--background))',
    			foreground: 'hsl(var(--foreground))',
    			primary: {
    				DEFAULT: 'hsl(var(--primary))',
    				foreground: 'hsl(var(--primary-foreground))',
    				light: 'hsl(var(--primary-light))'
    			},
    			secondary: {
    				DEFAULT: 'hsl(var(--secondary))',
    				foreground: 'hsl(var(--secondary-foreground))'
    			},
    			destructive: {
    				DEFAULT: 'hsl(var(--destructive))',
    				foreground: 'hsl(var(--destructive-foreground))'
    			},
    			muted: {
    				DEFAULT: 'hsl(var(--muted))',
    				foreground: 'hsl(var(--muted-foreground))'
    			},
    			accent: {
    				DEFAULT: 'hsl(var(--accent))',
    				foreground: 'hsl(var(--accent-foreground))'
    			},
    			popover: {
    				DEFAULT: 'hsl(var(--popover))',
    				foreground: 'hsl(var(--popover-foreground))'
    			},
    			card: {
    				DEFAULT: 'hsl(var(--card))',
    				foreground: 'hsl(var(--card-foreground))'
    			},
    			success: {
    				DEFAULT: 'hsl(var(--success))',
    				light: 'hsl(var(--success-light))'
    			},
    			sidebar: {
    				DEFAULT: 'hsl(var(--sidebar-background))',
    				foreground: 'hsl(var(--sidebar-foreground))',
    				primary: 'hsl(var(--sidebar-primary))',
    				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
    				accent: 'hsl(var(--sidebar-accent))',
    				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
    				border: 'hsl(var(--sidebar-border))',
    				ring: 'hsl(var(--sidebar-ring))'
    			},
    			chart: {
    				'1': 'hsl(var(--chart-1))',
    				'2': 'hsl(var(--chart-2))',
    				'3': 'hsl(var(--chart-3))',
    				'4': 'hsl(var(--chart-4))',
    				'5': 'hsl(var(--chart-5))'
    			},
    			admin: {
    				'page-bg': 'hsl(var(--admin-page-bg))',
    				'sidebar-bg': 'hsl(var(--admin-sidebar-bg))',
    				'header-bg': 'hsl(var(--admin-header-bg))',
    				'content-bg': 'hsl(var(--admin-content-bg))'
    			}
    		},
    		borderRadius: {
    			lg: 'var(--radius)',
    			md: 'calc(var(--radius) - 2px)',
    			sm: 'calc(var(--radius) - 4px)'
    		},
    		keyframes: {
    			'accordion-down': {
    				from: {
    					height: '0'
    				},
    				to: {
    					height: 'var(--radix-accordion-content-height)'
    				}
    			},
    			'accordion-up': {
    				from: {
    					height: 'var(--radix-accordion-content-height)'
    				},
    				to: {
    					height: '0'
    				}
    			},
    			'grow-bar': {
    				from: {
    					transform: 'scaleY(0)'
    				},
    				to: {
    					transform: 'scaleY(1)'
    				}
    			},
    			'fade-slide-up': {
    				from: {
    					opacity: '0',
    					transform: 'translateY(30px)'
    				},
    				to: {
    					opacity: '1',
    					transform: 'translateY(0)'
    				}
    			},
    			'bounce-gentle': {
    				'0%, 100%': {
    					transform: 'translateY(0)'
    				},
    				'50%': {
    					transform: 'translateY(-10px)'
    				}
    			},
    			blob: {
    				'0%, 100%': {
    					transform: 'translate3d(0, 0, 0) scale(1)'
    				},
    				'30%': {
    					transform: 'translate3d(36px, -28px, 0) scale(1.06)'
    				},
    				'60%': {
    					transform: 'translate3d(-22px, 18px, 0) scale(0.94)'
    				}
    			},
    			shimmer: {
    				'0%': {
    					transform: 'translateX(-60%)'
    				},
    				'100%': {
    					transform: 'translateX(140%)'
    				}
    			},
    			float: {
    				'0%, 100%': {
    					transform: 'translate3d(0, 0, 0)'
    				},
    				'50%': {
    					transform: 'translate3d(0, -10px, 0)'
    				}
    			}
    		},
    		animation: {
    			'accordion-down': 'accordion-down 0.2s ease-out',
    			'accordion-up': 'accordion-up 0.2s ease-out',
    			'grow-bar': 'grow-bar 1s ease-out forwards',
    			'fade-slide-up': 'fade-slide-up 0.6s ease-out',
    			'bounce-gentle': 'bounce-gentle 2s ease-in-out infinite',
    			'blob-slow': 'blob 18s ease-in-out infinite',
    			'blob-slower': 'blob 26s ease-in-out infinite',
    			'blob-slowest': 'blob 34s ease-in-out infinite',
    			'shimmer-slow': 'shimmer 2.6s ease-in-out infinite',
    			'float-slow': 'float 6s ease-in-out infinite',
    			'float-slower': 'float 8s ease-in-out infinite'
    		},
    		boxShadow: {
    			'2xs': 'var(--shadow-2xs)',
    			xs: 'var(--shadow-xs)',
    			sm: 'var(--shadow-sm)',
    			md: 'var(--shadow-md)',
    			lg: 'var(--shadow-lg)',
    			xl: 'var(--shadow-xl)',
    			'2xl': 'var(--shadow-2xl)'
    		},
    		fontFamily: {
    			sans: [
    				'Roboto',
    				'ui-sans-serif',
    				'system-ui',
    				'sans-serif',
    				'Apple Color Emoji',
    				'Segoe UI Emoji',
    				'Segoe UI Symbol',
    				'Noto Color Emoji'
    			],
    			serif: [
    				'Lora',
    				'ui-serif',
    				'Georgia',
    				'Cambria',
    				'Times New Roman',
    				'Times',
    				'serif'
    			],
    			mono: [
    				'Fira Code',
    				'ui-monospace',
    				'SFMono-Regular',
    				'Menlo',
    				'Monaco',
    				'Consolas',
    				'Liberation Mono',
    				'Courier New',
    				'monospace'
    			]
    		}
    	}
    },
    plugins: [tailwindcssAnimate],
} satisfies Config;
