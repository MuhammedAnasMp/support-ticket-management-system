import React from 'react';

interface LogoLoaderProps {
    /** Custom width string/number, e.g. "250px", "100%", or 200 */
    size?: string | number;
    /** Extra Tailwind or CSS classes for container */
    className?: string;
    /** Render full screen overlay centered */
    fullScreen?: boolean;
    /** Enable soft background radial glow/shadow */
    showGlow?: boolean;
    /** Accessible label for screen readers */
    label?: string;
}

export const LogoLoader: React.FC<LogoLoaderProps> = ({
    size,
    className = '',
    fullScreen = false,
    showGlow = false,
    label = 'Loading...',
}) => {
    const widthStyle = size ? (typeof size === 'number' ? `${size}px` : size) : undefined;

    const content = (
        <div
            className={`logo-loader-container ${showGlow ? 'has-glow' : ''} ${className}`}
            style={widthStyle ? { width: widthStyle, maxWidth: '100%' } : undefined}
            role="img"
            aria-label={label}
        >
            <style>{`
        @keyframes logoLoaderAtmosphere {
          0%, 100% {
            transform: scale(0.88);
            opacity: 0.35;
          }
          50% {
            transform: scale(1.06);
            opacity: 0.75;
          }
        }

        @keyframes logoLoaderLiquidFlow {
          from {
            stroke-dashoffset: 0;
          }
          to {
            stroke-dashoffset: -1000;
          }
        }

        @keyframes logoLoaderHeadPulse {
          0%, 100% {
            opacity: 0.88;
          }
          50% {
            opacity: 1;
          }
        }

        @keyframes logoLoaderBreath {
          0%, 100% {
            transform: scale(0.988);
          }
          50% {
            transform: scale(1.008);
          }
        }

        .logo-loader-container {
          position: relative;
          width: clamp(200px, 50vw, 285px);
          aspect-ratio: 5 / 1;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .logo-loader-container.has-glow::before {
          content: "";
          position: absolute;
          inset: -10%;
          border-radius: 50%;
          background: radial-gradient(
            circle,
            rgba(225, 29, 46, 0.15) 0%,
            rgba(225, 29, 46, 0.06) 30%,
            transparent 70%
          );
          animation: logoLoaderAtmosphere 7s ease-in-out infinite;
          pointer-events: none;
        }

        .logo-loader-svg {
          position: relative;
          width: 100%;
          height: 100%;
          overflow: visible;
        }

        .logo-base {
          fill: none;
          stroke: #e4e4e4;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .flow {
          fill: none;
          stroke: #e11d2e;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-dasharray: 20 5;
          animation: logoLoaderLiquidFlow 100s linear infinite;
        }

        .flow-back {
          stroke-width: 150px;
          opacity: 1;
        }

        .flow-soft {
          stroke-width: 23px;
          opacity: 0.16;
          filter: blur(0.5px);
        }

        .flow-mid {
          stroke-width: 30px;
          opacity: 0.34;
        }

        .flow-main {
          stroke-width: 38px;
          opacity: 0.72;
        }

        .flow-head {
          stroke-width: 46px;
          opacity: 1;
          filter: drop-shadow(0 0 5px rgba(225, 29, 46, 0.7)) drop-shadow(0 0 12px rgba(225, 29, 46, 0.4));
          animation: logoLoaderLiquidFlow 100s linear infinite, logoLoaderHeadPulse 2.5s ease-in-out infinite;
        }

        .flow-2 .flow {
          animation-delay: -50s;
        }

        .flow-2 .flow-head {
          animation-delay: -50s, 0s;
        }

        .logo-group {
          transform-origin: center;
          animation: logoLoaderBreath 9s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .logo-loader-container::before,
          .logo-group,
          .flow,
          .flow-head {
            animation: none;
          }
          .flow-head {
            opacity: 0.85;
          }
        }
      `}</style>

            <svg
                viewBox="0 0 1081 1081"
                xmlns="http://www.w3.org/2000/svg"
                className="logo-loader-svg"
            >
                <defs>
                    <g id="logoPath" transform="translate(0,1081) scale(0.10,-0.10)">
                        <path
                            pathLength="100"
                            d="M5817 9253 c-4 -3 -3 -11 2 -17 11 -13 39 -166 44 -241 2 -27 18 -135 35 -240 18 -104 37 -224 43 -265 6 -42 17 -80 25 -86 8 -6 33 -14 57 -18 152 -23 553 -173 747 -279 84 -46 202 -118 229 -138 32 -25 48 -24 89 9 19 15 50 38 68 52 18 14 155 123 304 244 149 120 274 215 278 211 4 -4 157 -154 340 -333 214 -209 332 -332 329 -342 -3 -12 -61 -97 -310 -450 -9 -14 -28 -41 -41 -60 -14 -19 -47 -66 -75 -105 -83 -114 -82 -100 -15 -212 143 -239 266 -520 342 -783 17 -58 34 -122 37 -143 5 -27 13 -38 29 -42 40 -8 211 -34 266 -40 124 -14 396 -56 412 -65 9 -5 31 -7 50 -4 64 9 61 33 66 -500 3 -267 2 -486 -1 -486 -2 0 -49 -9 -103 -20 -55 -12 -133 -25 -174 -31 -41 -5 -111 -17 -155 -26 -44 -9 -145 -25 -225 -37 l-144 -21 -9 -40 c-103 -494 -257 -844 -557 -1268 -22 -31 -44 -57 -48 -57 -6 0 -490 480 -530 525 -2 2 23 50 56 107 103 178 138 253 218 463 95 248 154 612 140 876 -24 493 -154 909 -402 1291 -160 247 -398 490 -631 646 -251 168 -517 280 -818 344 -148 32 -154 32 -420 32 -267 0 -272 -1 -425 -33 -504 -107 -935 -358 -1263 -736 -304 -349 -495 -768 -578 -1270 -18 -105 -18 -642 -1 -735 74 -396 201 -722 397 -1015 288 -433 724 -762 1219 -922 523 -168 1098 -131 1594 104 l53 25 152 -150 c84 -83 196 -193 250 -245 53 -51 97 -98 97 -103 0 -16 -78 -62 -265 -154 -77 -38 -171 -81 -210 -95 -119 -45 -308 -104 -353 -111 -24 -3 -49 -12 -56 -20 -12 -11 -34 -120 -51 -244 -3 -25 -19 -115 -34 -200 -16 -85 -35 -193 -42 -240 -6 -47 -16 -96 -22 -110 -6 -14 -9 -28 -9 -33 1 -4 -207 -7 -463 -7 l-465 1 0 26 c0 15 -13 106 -29 202 -16 97 -44 268 -62 381 -17 113 -33 210 -35 216 -1 6 -33 17 -71 24 -117 22 -346 97 -500 166 -175 77 -280 135 -456 252 l-78 52 -107 -77 c-59 -43 -114 -83 -122 -90 -8 -7 -116 -89 -240 -182 l-225 -169 -158 162 c-427 435 -503 515 -501 528 2 16 -7 2 245 360 102 144 203 287 224 317 29 43 35 58 27 70 -74 110 -230 403 -287 541 -70 171 -165 490 -165 557 0 30 -20 37 -140 53 -52 6 -165 22 -250 35 -85 13 -182 27 -215 30 -33 3 -93 11 -133 17 l-72 11 0 493 c0 389 3 494 13 494 8 0 7 4 -3 11 -11 8 -3 9 30 5 33 -5 41 -4 30 4 -11 8 -4 10 28 5 23 -4 42 -3 42 2 0 11 285 57 355 58 28 0 52 3 55 6 3 3 54 14 115 23 60 10 119 22 130 26 17 6 27 31 50 121 73 290 192 569 348 822 37 59 67 112 67 118 0 10 -66 101 -277 384 -61 83 -139 187 -172 231 -34 45 -61 86 -61 91 0 5 46 54 103 108 56 55 214 208 350 342 l248 243 67 -52 c37 -28 95 -74 128 -102 34 -28 90 -73 125 -101 54 -43 110 -89 289 -233 71 -58 72 -58 126 -26 213 129 408 228 596 300 102 39 344 110 406 120 23 4 44 9 46 13 2 3 16 76 30 161 15 85 40 227 57 315 16 89 29 170 29 180 0 41 34 194 42 189 4 -3 8 0 8 5 0 8 137 11 442 11 243 0 438 -3 435 -7z m-197 -2480 c487 -66 922 -389 1164 -863 l57 -110 -321 0 -321 0 -87 89 c-189 193 -382 289 -626 313 -321 30 -614 -74 -845 -300 -165 -162 -250 -313 -318 -567 -11 -43 -16 -107 -16 -225 -1 -140 2 -179 22 -260 28 -112 27 -109 81 -225 110 -236 289 -422 518 -542 75 -39 221 -89 296 -102 39 -7 143 -11 242 -10 l174 2 132 -139 c73 -76 163 -167 199 -202 96 -90 95 -93 -15 -135 -203 -78 -359 -107 -567 -107 -653 0 -1222 395 -1494 1035 -42 98 -87 269 -106 403 -28 192 -23 470 10 632 156 748 737 1275 1466 1329 113 9 208 4 355 -16z m-35 -1154 c22 -5 47 -13 55 -16 8 -3 21 -5 28 -4 6 1 12 -3 12 -9 0 -6 5 -8 10 -5 6 3 10 2 10 -3 0 -5 6 -9 13 -9 51 -2 226 -131 288 -214 56 -75 101 -173 126 -272 22 -90 25 -116 20 -222 -3 -66 -10 -132 -15 -146 -10 -24 -4 -32 82 -118 50 -50 97 -91 103 -91 25 0 131 230 148 323 l7 37 -111 0 -111 0 0 41 c0 76 -31 253 -55 313 -26 64 -24 86 9 87 62 3 792 -3 795 -7 10 -10 12 -251 3 -339 -33 -298 -115 -551 -253 -779 l-41 -68 22 -22 c12 -11 398 -400 858 -863 912 -918 889 -892 913 -1031 9 -48 8 -72 -5 -122 -33 -127 -89 -200 -193 -251 -139 -67 -286 -36 -410 87 -33 33 -156 160 -273 284 -196 206 -294 309 -486 507 -38 39 -150 155 -249 259 -99 103 -344 354 -545 558 -201 204 -439 446 -528 537 l-163 166 -62 -14 c-45 -11 -99 -14 -197 -10 -125 4 -142 7 -220 39 -155 62 -266 149 -346 270 -59 90 -107 205 -99 238 4 20 3 22 -6 10 -8 -12 -10 -8 -5 16 3 17 1 35 -4 40 -14 14 -23 143 -13 187 l8 38 89 -68 c49 -37 123 -94 165 -126 195 -150 194 -149 224 -143 28 6 87 27 246 90 l84 33 59 168 c32 93 58 174 58 180 0 11 -206 262 -282 345 -45 49 -78 93 -73 98 22 22 228 23 310 1z"
                        />
                    </g>
                </defs>

                <g className="logo-group">
                    <use href="#logoPath" className="logo-base" />
                    <use href="#logoPath" className="flow flow-back" />
                    <use href="#logoPath" className="flow flow-soft" />
                    <use href="#logoPath" className="flow flow-mid" />
                    <use href="#logoPath" className="flow flow-main" />
                    <use href="#logoPath" className="flow flow-head" />

                    <g className="flow-2">
                        <use href="#logoPath" className="flow flow-back" />
                        <use href="#logoPath" className="flow flow-soft" />
                        <use href="#logoPath" className="flow flow-mid" />
                        <use href="#logoPath" className="flow flow-main" />
                        <use href="#logoPath" className="flow flow-head" />
                    </g>
                </g>
            </svg>
        </div>
    );

    if (fullScreen) {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-surface dark:bg-dark-surface p-4">
                {content}
            </div>
        );
    }

    return content;
};

export default LogoLoader;
