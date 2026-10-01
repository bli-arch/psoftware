// @ts-nocheck
// Global variables
const empty = '',

    iconMap = {
        default: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="m2 2 20 20"/> <path d="M8.35 2.69A10 10 0 0 1 21.3 15.65"/> <path d="M19.08 19.08A10 10 0 1 1 4.92 4.92"/></svg>',
        star: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M12 6v12"> </path> <path d="M17.196 9 6.804 15"> </path> <path d="m6.804 9 10.392 6"> </path> </svg>',
        plus: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M5 12h14"> </path> <path d="M12 5v14"> </path> </svg>',
        minus: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M5 12h14"> </path> </svg>',
        check: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M20 6 9 17l-5-5"> </path> </svg>',
        chevronUpDown: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="m7 15 5 5 5-5"></path> <path d="m7 9 5-5 5 5"></path> </svg>',
        info: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <circle cx="12" cy="12" r="10"></circle> <path d="M12 16v-4"></path> <path d="M12 8h.01"></path> </svg>',
        circleUserRound: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M18 20a6 6 0 0 0-12 0"></path> <circle cx="12" cy="10" r="4"></circle> <circle cx="12" cy="12" r="10"></circle> </svg>',
        eye: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path> <circle cx="12" cy="12" r="3"></circle> </svg>',
        eyeOff: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"></path> <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"></path> <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"></path> <line x1="2" x2="22" y1="2" y2="22"></line> </svg>',
        group: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M3 7V5c0-1.1.9-2 2-2h2"/> <path d="M17 3h2c1.1 0 2 .9 2 2v2"/> <path d="M21 17v2c0 1.1-.9 2-2 2h-2"/> <path d="M7 21H5c-1.1 0-2-.9-2-2v-2"/> <rect width="7" height="5" x="7" y="7" rx="1"/> <rect width="7" height="5" x="10" y="12" rx="1"/></svg>',
        textCursorInput: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M5 4h1a3 3 0 0 1 3 3 3 3 0 0 1 3-3h1"/> <path d="M13 20h-1a3 3 0 0 1-3-3 3 3 0 0 1-3 3H5"/> <path d="M5 16H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h1"/> <path d="M13 8h7a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-7"/> <path d="M9 7v10"/></svg>',
        passwordEllipsisInput: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <rect width="20" height="12" x="2" y="6" rx="2"/> <path d="M12 12h.01"/> <path d="M17 12h.01"/> <path d="M7 12h.01"/></svg>',
        numberInput: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <rect width="20" height="12" x="2" y="6" rx="2"></rect> <path d="M5 10.5L7 9V15"/> <path d="M13.1 15H10C10 11.9 13.1 12.675 13.1 10.35C13.1 9.18756 11.55 8.41256 10 9.57505"/> <path d="M16.4712 9.29884C17.7332 8.55644 19.0695 9.29884 19.0695 10.4124C19.0695 10.8062 18.9131 11.1839 18.6347 11.4623C18.3562 11.7408 17.9785 11.8972 17.5848 11.8972"/> <path d="M16.1 14.4956C17.5848 15.6092 19.0695 14.7183 19.0695 13.382C19.0695 12.9882 18.9131 12.6105 18.6347 12.3321C18.3562 12.0536 17.9785 11.8972 17.5848 11.8972"/> </svg>',
        selectInput: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <rect width="20" height="8" x="2" y="8" rx="2"></rect> <path d="M15 11L17 13L19 11"/> </svg>',
        squareCheck: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <rect width="18" height="18" x="3" y="3" rx="2"/> <path d="m9 12 2 2 4-4"/></svg>',
        circleRadio: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4" fill="currentcolor"/></svg>',
        calendar: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M8 2v4"/> <path d="M16 2v4"/> <rect width="18" height="18" x="3" y="4" rx="2"/> <path d="M3 10h18"/></svg>',
        text: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M17 6.1H3"/> <path d="M21 12.1H3"/> <path d="M15.1 18H3"/></svg>',
        save: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/> <path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/> <path d="M7 3v4a1 1 0 0 0 1 1h7"/></svg>',
        pen: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/></svg>',
        trash: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>',

        bold: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8"></path></svg>',
        italic: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" x2="10" y1="4" y2="4"></line><line x1="14" x2="5" y1="20" y2="20"></line><line x1="15" x2="9" y1="4" y2="20"></line></svg>',
        underline: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4v6a6 6 0 0 0 12 0V4"></path><line x1="4" x2="20" y1="20" y2="20"></line></svg>',
        strikethrough: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4H9a3 3 0 0 0-2.83 4"/><path d="M14 12a4 4 0 0 1 0 8H6"/><line x1="4" x2="20" y1="12" y2="12"/></svg>',
        lowercase: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-case-lower"><circle cx="7" cy="12" r="3"/><path d="M10 9v6"/><circle cx="17" cy="12" r="3"/><path d="M14 7v8"/></svg>',
        uppercase: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-case-upper"><path d="m3 15 4-8 4 8"/><path d="M4 13h6"/><path d="M15 11h4.5a2 2 0 0 1 0 4H15V7h4a2 2 0 0 1 0 4"/></svg>',


        // special
        charger: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M17 21v-2a1 1 0 0 1-1-1v-1a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1a1 1 0 0 1-1 1"> </path> <path d="M19 15V6.5a1 1 0 0 0-7 0v11a1 1 0 0 1-7 0V9"> </path> <path d="M21 21v-2h-4"> </path> <path d="M3 5h4V3"> </path> <path d="M7 5a1 1 0 0 1 1 1v1a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1V3"> </path> </svg>',
        testTube: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M14.5 2v17.5c0 1.4-1.1 2.5-2.5 2.5c-1.4 0-2.5-1.1-2.5-2.5V2"/> <path d="M8.5 2h7"/> <path d="M14.5 16h-5"/> </svg>',
        testTubes: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M9 2v17.5A2.5 2.5 0 0 1 6.5 22A2.5 2.5 0 0 1 4 19.5V2"/> <path d="M20 2v17.5a2.5 2.5 0 0 1-2.5 2.5a2.5 2.5 0 0 1-2.5-2.5V2"/> <path d="M3 2h7"/> <path d="M14 2h7"/> <path d="M9 16H4"/> <path d="M20 16h-5"/> </svg>',
        smartphone: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <rect width="14" height="20" x="5" y="2" rx="2" ry="2"></rect> <path d="M12 18h.01"></path> </svg>',
        computer: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <rect width="14" height="8" x="5" y="2" rx="2"></rect> <rect width="20" height="8" x="2" y="14" rx="2"></rect> <path d="M6 18h2"></path> <path d="M12 18h6"></path> </svg>',
        keyRound: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"></path> <circle cx="16.5" cy="7.5" r=".5" fill="currentColor"></circle> </svg>',
        sun: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <circle cx="12" cy="12" r="4"/> <path d="M12 2v2"/> <path d="M12 20v2"/> <path d="m4.93 4.93 1.41 1.41"/> <path d="m17.66 17.66 1.41 1.41"/> <path d="M2 12h2"/> <path d="M20 12h2"/> <path d="m6.34 17.66-1.41 1.41"/> <path d="m19.07 4.93-1.41 1.41"/></svg>',
        moon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>',
        sunMoon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M12 8a2.83 2.83 0 0 0 4 4 4 4 0 1 1-4-4"/> <path d="M12 2v2"/> <path d="M12 20v2"/> <path d="m4.9 4.9 1.4 1.4"/> <path d="m17.7 17.7 1.4 1.4"/> <path d="M2 12h2"/> <path d="M20 12h2"/> <path d="m6.3 17.7-1.4 1.4"/> <path d="m19.1 4.9-1.4 1.4"/></svg>',
        barcodeScan: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M3 7V5a2 2 0 0 1 2-2h2" /> <path d="M17 3h2a2 2 0 0 1 2 2v2" /> <path d="M21 17v2a2 2 0 0 1-2 2h-2" /> <path d="M7 21H5a2 2 0 0 1-2-2v-2" /> <path d="M8 7v10" /> <path d="M12 7v10" /> <path d="M17 7v10" /> </svg>',
        phone: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"> </path> </svg>',
        barcode: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M3 5v14" /> <path d="M8 5v14" /> <path d="M12 5v14" /> <path d="M17 5v14" /> <path d="M21 5v14" /> </svg>',


        house: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/> <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
        bolt: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><circle cx="12" cy="12" r="4"/></svg>',
        package: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/> <path d="M12 22V12"/> <path d="m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7"/> <path d="m7.5 4.27 9 5.15"/></svg>',
        team: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M12 13.2C14.3196 13.2 16.2 11.3196 16.2 9.00005C16.2 6.68045 14.3196 4.80005 12 4.80005C9.68039 4.80005 7.79999 6.68045 7.79999 9.00005C7.79999 11.3196 9.68039 13.2 12 13.2Z"></path> <path d="M19.2 20.4C19.2 18.4904 18.4414 16.659 17.0912 15.3088C15.7409 13.9585 13.9095 13.2 12 13.2C10.0904 13.2 8.25908 13.9585 6.90882 15.3088C5.55856 16.659 4.79999 18.4904 4.79999 20.4"></path> <path d="M22.35 19C22.35 16.519 20.732 14.2147 19.114 13.1104C19.6459 12.7473 20.0712 12.2705 20.3523 11.7222C20.6333 11.1738 20.7616 10.5709 20.7256 9.96672C20.6896 9.36255 20.4905 8.77577 20.1459 8.25831C19.8013 7.74084 19.3219 7.30866 18.75 7"></path> <path d="M1.65 19C1.65 16.519 3.26798 14.2147 4.88595 13.1104C4.35411 12.7473 3.92883 12.2705 3.64774 11.7222C3.36666 11.1738 3.23844 10.5709 3.27443 9.96672C3.31043 9.36255 3.50953 8.77577 3.85411 8.25831C4.19869 7.74084 4.67813 7.30866 5.25 7"></path> </svg>',

        cog: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>',
        circleUserRound: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M18 20a6 6 0 0 0-12 0"/><circle cx="12" cy="10" r="4"/><circle cx="12" cy="12" r="10"/></svg>',

        userRoundCog: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M2 21a8 8 0 0 1 10.434-7.62"/><circle cx="10" cy="8" r="5"/><circle cx="18" cy="18" r="3"/> <path d="m19.5 14.3-.4.9"/> <path d="m16.9 20.8-.4.9"/> <path d="m21.7 19.5-.9-.4"/> <path d="m15.2 16.9-.9-.4"/> <path d="m21.7 16.5-.9.4"/> <path d="m15.2 19.1-.9.4"/> <path d="m19.5 21.7-.4-.9"/> <path d="m16.9 15.2-.4-.9"/></svg>',
        sparkles: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/> <path d="M20 3v4"/> <path d="M22 5h-4"/> <path d="M4 17v2"/> <path d="M5 18H3"/></svg>',
        monitorSmartphone: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M18 8V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h8"/> <path d="M10 19v-3.96 3.15"/> <path d="M7 19h5"/> <rect width="6" height="10" x="16" y="12" rx="2"/></svg>',
        squareSlash: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <rect width="18" height="18" x="3" y="3" rx="2"/><line x1="9" x2="15" y1="15" y2="9"/></svg>',
        rook: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M5 22V18H19V22H5Z"></path> <path d="M6 9V2H10.2353V5H13.7647V2H18V9H6Z"></path> <path d="M8 10V18M16 18V10"></path> </svg>',
        usersRound: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"round"> <path d="M18 21a8 8 0 0 0-16 0"/><circle cx="10" cy="8" r="5"/> <path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3"/></svg>',
        server: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <rect width="20" height="8" x="2" y="2" rx="2" ry="2"/> <rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/></svg>',
        waypoints: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <circle cx="12" cy="4.5" r="2.5"/> <path d="m10.2 6.3-3.9 3.9"/><circle cx="4.5" cy="12" r="2.5"/> <path d="M7 12h10"/><circle cx="19.5" cy="12" r="2.5"/> <path d="m13.8 17.7 3.9-3.9"/><circle cx="12" cy="19.5" r="2.5"/></svg>',
        messageSquareText: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/> <path d="M13 8H7"/> <path d="M17 12H7"/></svg>',
        shield: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>',

        // banners/illustrations
        lightkModeBanner: '',
        darkModeBanner: '',
        dynamicModeBanner: '',


        // brand logos
        apple: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"> <path d="M20.9163 8.18242C20.7771 8.29043 18.3192 9.67537 18.3192 12.7549C18.3192 16.3168 21.4467 17.577 21.5404 17.6082C21.526 17.685 21.0435 19.3339 19.8914 21.0141C18.8641 22.4926 17.7912 23.9688 16.159 23.9688C14.5269 23.9688 14.1068 23.0207 12.2226 23.0207C10.3864 23.0207 9.73357 24 8.24062 24C6.74767 24 5.70597 22.6319 4.50825 20.9517C3.12091 18.9787 2 15.9136 2 13.0045C2 8.33843 5.0339 5.86379 8.0198 5.86379C9.60636 5.86379 10.9289 6.90549 11.925 6.90549C12.8731 6.90549 14.3516 5.80138 16.1566 5.80138C16.8407 5.80138 19.2985 5.86379 20.9163 8.18242ZM15.2997 3.82598C16.0462 2.94029 16.5743 1.71137 16.5743 0.482448C16.5743 0.312031 16.5599 0.139214 16.5287 0C15.3141 0.0456046 13.8692 0.808881 12.9979 1.81938C12.3138 2.59706 11.6754 3.82598 11.6754 5.07171C11.6754 5.25893 11.7066 5.44614 11.721 5.50615C11.7978 5.52055 11.9226 5.53735 12.0474 5.53735C13.1371 5.53735 14.5077 4.80768 15.2997 3.82598Z" fill="black"/> </svg>',
        samsung: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"> <path d="M23.9851 9.89723C24.3121 11.7708 19.2115 14.2245 12.5915 15.3774C5.97225 16.5304 0.341219 15.9454 0.0148057 14.071C-0.311344 12.1972 4.79052 9.74431 11.4098 8.59157C18.0293 7.43805 23.6592 8.02312 23.9851 9.89723Z" fill="#034EA2"/> <path d="M17.755 12.6787L17.721 10.7305H18.3353V13.186H17.4521L16.8391 11.1708H16.8259L16.8599 13.186H16.2495V10.7305H17.171L17.7413 12.6787H17.755Z" fill="white"/> <path d="M6.58795 10.9604L6.24809 13.2118H5.57812L6.03822 10.7305H7.14191L7.59989 13.2118H6.93256L6.60193 10.9604H6.58795Z" fill="white"/> <path d="M9.16067 13.2118L8.74567 10.9809H8.73222L8.71667 13.2118H8.09521L8.15006 10.7305H9.16252L9.46889 12.6273H9.48208L9.78872 10.7305H10.8007L10.8544 13.2118H10.2343L10.218 10.9809H10.205L9.7903 13.2118H9.16067Z" fill="white"/> <path d="M4.53355 12.5117C4.55781 12.5719 4.55043 12.6491 4.53909 12.6958C4.51826 12.7783 4.46236 12.8624 4.29731 12.8624C4.14175 12.8624 4.04736 12.7733 4.04736 12.637V12.3968H3.38188L3.38135 12.589C3.38135 13.1422 3.81692 13.3091 4.2836 13.3091C4.73235 13.3091 5.10201 13.1556 5.1608 12.7422C5.19086 12.5278 5.16845 12.3876 5.15817 12.3346C5.05349 11.8152 4.11169 11.6601 4.04156 11.3696C4.02969 11.3197 4.03312 11.267 4.03892 11.2388C4.05606 11.1597 4.11037 11.0724 4.26567 11.0724C4.41068 11.0724 4.49638 11.1621 4.49638 11.2976C4.49638 11.3432 4.49638 11.4508 4.49638 11.4508H5.11519V11.2765C5.11519 10.736 4.63005 10.6516 4.27859 10.6516C3.83722 10.6516 3.47653 10.7974 3.41061 11.2013C3.39269 11.3129 3.39005 11.4123 3.41615 11.5367C3.52452 12.0437 4.40594 12.1906 4.53355 12.5117Z" fill="white"/> <path d="M12.6021 12.5072C12.6266 12.5668 12.6187 12.642 12.6076 12.6886C12.5873 12.7709 12.5319 12.8537 12.3679 12.8537C12.2145 12.8537 12.1209 12.7646 12.1209 12.6314L12.1204 12.3933H11.4617L11.4609 12.5829C11.4609 13.1305 11.8926 13.2958 12.3545 13.2958C12.7985 13.2958 13.1647 13.1445 13.2225 12.7348C13.2525 12.522 13.2312 12.3836 13.2204 12.3316C13.1162 11.817 12.1839 11.6635 12.1146 11.3759C12.1027 11.3263 12.1061 11.2741 12.1122 11.2474C12.1298 11.1678 12.1831 11.0827 12.3368 11.0827C12.4805 11.0827 12.5644 11.1702 12.5644 11.3047C12.5644 11.3498 12.5644 11.4563 12.5644 11.4563H13.1784V11.2838C13.1784 10.7491 12.6972 10.6653 12.3492 10.6653C11.9129 10.6653 11.5551 10.8092 11.4905 11.2103C11.4725 11.3202 11.4707 11.4178 11.4963 11.5417C11.6031 12.0434 12.4758 12.1893 12.6021 12.5072Z" fill="white"/> <path d="M14.6861 12.8404C14.8583 12.8404 14.9121 12.7212 14.924 12.6603C14.929 12.6334 14.9303 12.5976 14.9298 12.5654V10.7292H15.5573V12.5092C15.5586 12.5548 15.5541 12.6487 15.552 12.6722C15.508 13.1354 15.1417 13.2857 14.6859 13.2857C14.2295 13.2857 13.863 13.1354 13.8195 12.6722C13.8174 12.6487 13.8129 12.5548 13.8142 12.5092V10.7292H14.4412V12.5654C14.4412 12.5976 14.4422 12.6337 14.447 12.6603C14.4604 12.7212 14.5126 12.8404 14.6861 12.8404Z" fill="white"/> <path d="M19.8627 12.8144C20.0425 12.8144 20.1053 12.7007 20.1169 12.6345C20.1214 12.6061 20.1227 12.5715 20.1224 12.5402V12.18H19.8677V11.8177H20.7476V12.4837C20.747 12.5301 20.746 12.5644 20.7386 12.6472C20.6972 13.0986 20.3057 13.2597 19.8659 13.2597C19.4253 13.2597 19.0343 13.0986 18.9924 12.6472C18.9852 12.5644 18.9842 12.5301 18.9834 12.4837L18.9839 11.4388C18.9839 11.3948 18.9895 11.3168 18.9942 11.2754C19.0493 10.8116 19.4253 10.6624 19.8659 10.6624C20.3059 10.6624 20.6911 10.8108 20.7368 11.2754C20.7449 11.3545 20.7423 11.4388 20.7423 11.4388V11.5216H20.1166V11.3827C20.1171 11.3829 20.1158 11.3236 20.1084 11.2883C20.0979 11.2334 20.0502 11.1074 19.8611 11.1074C19.6803 11.1074 19.6273 11.2266 19.6141 11.2883C19.6064 11.321 19.6035 11.3653 19.6035 11.4054V12.5402C19.603 12.5715 19.6049 12.6061 19.6099 12.6345C19.6207 12.701 19.6832 12.8144 19.8627 12.8144Z" fill="white"/> </svg>',
        xiaomi: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"> <g clip-path="url(#clip0_420_2)"> <path d="M21.4985 2.50763C19.2342 0.252094 15.9785 0 12 0C8.01647 0 4.75584 0.255 2.49253 2.51663C0.229547 4.77731 0 8.03269 0 12.0117C0 15.9913 0.229547 19.2477 2.49347 21.5092C4.75664 23.7711 8.01689 24 12 24C15.9832 24 19.2428 23.7711 21.506 21.5092C23.7698 19.2472 24 15.9913 24 12.0117C24 8.02758 23.7673 4.76869 21.4985 2.50763Z" fill="#FF6900"/> <path d="M18.9635 7.43457C19.0459 7.43457 19.1146 7.50099 19.1146 7.58274V16.4602C19.1146 16.5406 19.0459 16.6074 18.9635 16.6074H17.0184C16.9349 16.6074 16.8671 16.5406 16.8671 16.4602V7.58274C16.8671 7.50104 16.9348 7.43457 17.0184 7.43457H18.9635ZM10.5223 7.43457C11.9897 7.43457 13.5239 7.50184 14.2806 8.25905C15.0245 9.00423 15.1051 10.4879 15.1082 11.9287V16.4602C15.1082 16.5406 15.0404 16.6073 14.9573 16.6073H13.0125C12.9292 16.6073 12.8611 16.5406 12.8611 16.4602V11.8508C12.8591 11.0461 12.8128 10.219 12.3978 9.8027C12.0406 9.44452 11.3741 9.36249 10.681 9.34548H7.15554C7.07286 9.34548 7.00517 9.41199 7.00517 9.49248V16.4602C7.00517 16.5406 6.93664 16.6074 6.85343 16.6074H4.90737C4.82421 16.6074 4.75732 16.5406 4.75732 16.4602V7.58274C4.75732 7.50104 4.82417 7.43457 4.90737 7.43457H10.5223ZM10.9577 10.9702C11.0404 10.9702 11.1077 11.0364 11.1077 11.1175V16.4602C11.1077 16.5406 11.0404 16.6074 10.9577 16.6074H8.91467C8.83067 16.6074 8.76336 16.5406 8.76336 16.4602V11.1175C8.76336 11.0364 8.83067 10.9702 8.91467 10.9702H10.9577Z" fill="white"/> </g> <defs> <clipPath id="clip0_420_2"> <rect width="24" height="24" fill="white"/> </clipPath> </defs> </svg>'
    }

    // kebabToCamel = str => str.replace(/-./g, m => m.toUpperCase()[1]),
    // camelToKebab = str => str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

function inputStyler() {
    document.querySelectorAll('[istyler]').forEach((element) => {
        const attributes = getAttributes(element);
        element.replaceWith(createStylisedInput(attributes));
    });
    handleFunctionnalityFunctions()
    const event = new Event("istylerReady");
    document.dispatchEvent(event);
}

function iconSetter() {
    document.querySelectorAll('icon').forEach((element) => {
        const iconName = element.getAttribute('icon-name') || undefined
        const iconClass = element.hasAttribute('class') ? element.getAttribute('class').split(' ') : undefined
        element.replaceWith(utilityCreateIcon(iconName, iconClass));
    });
}

function createContainerLabel(labelLayout = [], parentClass = [], labelFor = null, attributes = null) {
    const containerLabel = document.createElement('label');
    if (labelFor) {
        containerLabel.setAttribute('for', labelFor);
    }
    if (attributes) {
        containerLabel.setAttribute('config', JSON.stringify(attributes))
    }
    labelLayout.forEach(element => containerLabel.append(element));
    parentClass
        .filter(Boolean)  // Filters out any falsy values in parentClass
        .forEach(classValue => containerLabel.classList.add(classValue)); 
    return containerLabel;
}


function getAttributes(element) {
    const attributes = {
        // normal
        label: element.getAttribute('label'),
        type: element.getAttribute('type'),
        placeholder: element.getAttribute('placeholder'),
        name: element.getAttribute('name'),
        class: element.getAttribute('class'),
        helpText: element.getAttribute('help-text'),
        display: element.getAttribute('display'),
        value: element.getAttribute('value'),
        min: element.getAttribute('min'),
        max: element.getAttribute('max'),
        step: element.getAttribute('step'),
        icon: element.getAttribute('icon'),
        checkbox: element.getAttribute('checkbox'),  // Possibility to change it to boolean, modify the css first then the code
        checkmark: element.getAttribute('checkmark'),
        options: JSON.parse(element.getAttribute('options')), // ARRAY, maybe change handling method
        arrow: element.getAttribute('arrow'),
        iconSide: element.getAttribute('icon-side'),
        affix: element.getAttribute('affix'),
        affixText: element.getAttribute('affix-text'),
        showPasswordIcons: element.getAttribute('show-password-icons'),
        side: element.getAttribute('side'),
        groupContent: JSON.parse(element.getAttribute('group-content')), // ARRAY, maybe change handling method
        description: element.getAttribute('description'),
        incrementPattern: JSON.parse(element.getAttribute('increment-pattern')),
        parentClass: element.getAttribute('parent-class'),

        // boolean
        required: element.hasAttribute('required'),
        disabled: element.hasAttribute('disabled'),
        readonly: element.hasAttribute('readonly'),
        box: element.hasAttribute('box'),
        checked: element.hasAttribute('checked'),
        ghosted: element.hasAttribute('ghosted'),
        helpTextIcon: element.hasAttribute('help-text-icon'),
        showPassword: element.hasAttribute('show-password'),
        sensitiveToDrop: element.hasAttribute('sensitive-to-drop'),
        incrementGroup: element.hasAttribute('increment-group')
    };

    // Loop through all attributes and add any unspecified ones
    for (let attr of element.attributes) {
        const name = attr.name //kebabToCamel(attr.name)
        if (!(name in attributes)) {
            attributes[name] = attr.value;
        }
    }

    return attributes
}

function createStylisedLabel(attributes, principal = true) {
    if (!attributes.label) return empty;
    const span = document.createElement('span');
    span.classList.add('input-label');
    span.textContent = attributes.label;
    if (attributes.required && principal) span.appendChild(utilityCreateIcon('star', ['required-star'], { 'data-title': 'Ce champ est requis' }));
    if (attributes.options && !principal) {
        attributes.options.forEach((radio) => {
            if (radio.checked) span.textContent = radio.label
        })
    }


    return span;
}

function createStylisedHelpText(attributes) {
    if (!attributes.helpText) return empty;
    const span = document.createElement('span');
    span.classList.add('input-help-text');
    span.append(utilityCreateIcon('info', 'help-icon'))
    span.textContent = attributes.helpText;
    if (attributes.helpTextIcon) span.insertBefore(utilityCreateIcon('info', ['help-icon']), span.firstChild);
    return span;
}

function createStylisedInput(attributes) {
    switch (attributes.type) {
        case 'hidden':
            return createDefaultInput(attributes);
        case 'text':
            return createTextInput(attributes);
        case 'password':
            return createPasswordInput(attributes);
        case 'number':
            return createNumberInput(attributes);
        case 'checkbox':
            return createCheckbox(attributes);
        case 'radio':
            return createRadio(attributes);
        case 'select':
            return createSelect(attributes);
        case 'multi-select':
            return createMultiSelect(attributes);
        case 'textarea':
            return createTextarea(attributes);
        case 'group':
            return createGroup(attributes);
        case 'not-input':
            return createNotInput(attributes);
        case 'button':
            return createButton(attributes);
        default:
            return createDefaultInput(attributes);
    }
}

function createDefaultInput(attributes, type = 'input') {
    const input = document.createElement(type);
    input.type = attributes.type;
    attributes.placeholder ? input.placeholder = attributes.placeholder : empty;
    if (attributes.required) input.setAttribute('required', empty);
    if (attributes.disabled) input.setAttribute('disabled', empty);
    if (attributes.readonly) input.setAttribute('readonly', empty);
    if (attributes.name) input.name = attributes.name;
    if (attributes.value) input.value = attributes.value;
    if (attributes.checked) input.checked = attributes.checked;
    if (attributes.class) input.classList.add(attributes.class)

    return input
}

function createTextInput(attributes) {
    const container = document.createElement('div');
    container.classList.add('input-container');

    const input = createDefaultInput(attributes)

    if (attributes.icon) {
        if (attributes.iconSide === "both") {
            container.setAttribute("icon", 'both')
            const [left, right] = attributes.icon.split(',').map(item => item.trim())
            container.append(utilityCreateIcon(left, ['input-icon', '--left']), input, utilityCreateIcon(right, ['input-icon', '--right']));
        }
        else if (attributes.iconSide === "left") {
            container.setAttribute("icon", 'left')
            container.append(utilityCreateIcon(attributes.icon, ['input-icon', '--left']), input);
        }
        else {
            container.setAttribute("icon", 'right')
            container.append(input, utilityCreateIcon(attributes.icon, ['input-icon', '--right']));
        }
    }

    else if (attributes.affix) {
        const span = document.createElement('span')
        span.classList.add('input-affix')
        span.textContent = attributes.affixText || empty

        if (attributes.affix === "prefix") {
            span.classList.add('--prefix')
            container.setAttribute("affix", attributes.affix)
            container.append(span, input);
        }
        else {
            span.classList.add('--suffix')
            container.setAttribute("affix", attributes.affix)
            container.append(input, span);
        }
    }
    else {
        container.append(input);
    }

    return createContainerLabel([createStylisedLabel(attributes), container, createStylisedHelpText(attributes)], [attributes.parentClass], null, attributes);
}

function createPasswordInput(attributes) {
    const container = document.createElement('div');
    container.classList.add('input-container');

    const input = createDefaultInput(attributes)

    if (attributes.icon && attributes.showPassword) {

        const [show, hide] = attributes.showPasswordIcons.split(',').map(item => item.trim()) // handle case where showPasswordIcons is not provided

        const showPassword = attributes.showPassword ? { 'onclick': 'togglePasswordVisibility(this)' } : {}

        container.setAttribute("icon", 'both')
        if (attributes.iconSide === "left") {
            container.append(
                utilityCreateIcon(attributes.icon, ['input-icon', '--left']),
                input,
                utilityCreateButton([utilityCreateIcon(show), utilityCreateIcon(hide, [], { 'style': 'display:none' })], ['input-icon', '--clickable-icon'], showPassword)
            );
        }
        else {
            container.append(
                utilityCreateButton([utilityCreateIcon(show), utilityCreateIcon(hide, [], { 'style': 'display:none' })], ['input-icon', '--clickable-icon'], showPassword),
                input,
                utilityCreateIcon(attributes.icon, ['input-icon', '--right'])
            );
        }
    }
    else {
        container.append(input);
    }

    return createContainerLabel([createStylisedLabel(attributes), container, createStylisedHelpText(attributes)], [attributes.parentClass], null, attributes);
}

function createNumberInput(attributes) {
    const container = document.createElement('div');
    container.classList.add('input-container');

    const input = createDefaultInput(attributes);
    // if (attributes.icon) container.setAttribute("icon", attributes.icon); // icon attribute, refactor!
    if (attributes.min) input.min = attributes.min;
    if (attributes.max) input.max = attributes.max;
    if (attributes.step) input.step = attributes.step;

    const decrementButton = utilityCreateButton([utilityCreateIcon('minus')], ['input-icon', '--clickable-icon'], { 'numberinputcontrol': 'decrement' });
    const incrementButton = utilityCreateButton([utilityCreateIcon('plus')], ['input-icon', '--clickable-icon'], { 'numberinputcontrol': 'increment' });

    if (attributes.display === 'lateral') {
        container.setAttribute("icon", "both")
        container.append(decrementButton, input, incrementButton);
    }
    else {
        if (attributes.iconSide === "left") {
            container.setAttribute("icon", 'left')
            container.append(decrementButton, incrementButton, input);
        }
        else {
            container.setAttribute("icon", 'right')
            container.append(input, decrementButton, incrementButton);
        }
    }

    return createContainerLabel([createStylisedLabel(attributes), container, createStylisedHelpText(attributes)], [attributes.parentClass], null, attributes);
}

function createCheckbox(attributes) {
    const container = document.createElement('div');
    container.classList.add('option-container');

    const option = document.createElement('div');
    option.classList.add('option');

    const input = createDefaultInput(attributes);
    if (attributes.checked) input.checked = attributes.checked;
    if (attributes.display) input.setAttribute('display', attributes.display);

    const icon = attributes.icon ? utilityCreateIcon(attributes.icon) : empty
    const checkmark = attributes.checkmark ? utilityCreateIcon(attributes.checkmark, ['checkmark']) : empty

    option.append(input, checkmark)

    if (attributes.side === 'left') {
        container.append(createStylisedLabel(attributes), icon, option)
    }
    else {
        container.append(option, icon, createStylisedLabel(attributes))
    }


    if (attributes.box) {
        const box = document.createElement('div');
        box.classList.add('option-box');
        if (attributes.ghosted) box.classList.add('ghosted');
        if (attributes.checkbox) box.setAttribute('checkbox', attributes.checkbox);

        box.append(container, createStylisedHelpText(attributes))
        return createContainerLabel([box], [attributes.parentClass], null, attributes);
    }
    else {
        return createContainerLabel([container], [attributes.parentClass], null, attributes);
    }
}

function createRadio(attributes) {
    const container = document.createElement('div');
    container.classList.add('option-container');

    const option = document.createElement('div');
    option.classList.add('option');

    const input = createDefaultInput(attributes);
    if (attributes.checked) input.checked = attributes.checked;
    if (attributes.display) input.setAttribute('display', attributes.display);

    const icon = attributes.icon ? utilityCreateIcon(attributes.icon) : empty
    const checkmark = attributes.checkmark ? utilityCreateIcon(attributes.checkmark, ['checkmark']) : empty

    option.append(input, checkmark)

    container.append(option, icon, createStylisedLabel(attributes))

    if (attributes.box) {
        const box = document.createElement('div');
        box.classList.add('option-box');

        if (attributes.ghosted) box.classList.add('ghosted');
        if (attributes.checkbox) box.setAttribute('checkbox', attributes.checkbox);

        box.append(container, createStylisedHelpText(attributes))
        return createContainerLabel([box], [attributes.parentClass], null, attributes);
    }
    else {
        return createContainerLabel([container], [attributes.parentClass], null, attributes);
    }
}

function createSelect(attributes) {

    const container = document.createElement('div');
    container.classList.add('select-container');
    container.setAttribute('type', attributes.type)
    container.setAttribute('default-label', attributes.label)
    if (attributes.required) container.setAttribute('required', empty);
    if (attributes.name) container.setAttribute('name', attributes.name)


    const button = document.createElement('button')
    button.classList.add('select-button', 'input-container');

    const selectedValue = document.createElement('div')
    selectedValue.classList.add('selected-value', 'option-container')

    const labelContainer = document.createElement('div')
    labelContainer.classList.add('select-label-container')
    labelContainer.append(createStylisedLabel(attributes, false))

    selectedValue.append(labelContainer)
    button.append(selectedValue, utilityCreateIcon(attributes.arrow || 'chevronUpDown', ['input-icon', '--right', '--clickable-icon'])) // adapt the "--right" class


    const dropdown = document.createElement('div');
    dropdown.classList.add('select-dropdown');

    const innerDropdown = document.createElement('ul');
    innerDropdown.classList.add('select-inner-dropdown');
    innerDropdown.setAttribute('smooth-hover-effect', empty)

    dropdown.append(innerDropdown)

    attributes.options.forEach((radio) => {
        radio.type = 'radio'
        radio.box = true,
            radio.ghosted = true,
            radio.checkbox = attributes.checkbox
        radio.name = attributes.name
        radio.class = 'select-type'

        const option = document.createElement('li');
        option.classList.add('select-option');

        option.append(createRadio(radio))
        innerDropdown.append(option)

        if (radio.checked && radio.icon) labelContainer.insertBefore(utilityCreateIcon(radio.icon), labelContainer.firstChild);
    })

    container.append(button, dropdown)
    return createContainerLabel([createStylisedLabel(attributes), container, createStylisedHelpText(attributes)], [attributes.parentClass], null, attributes);
}

function createMultiSelect(attributes) {

    const container = document.createElement('div');
    container.classList.add('select-container');
    container.setAttribute('type', attributes.type)
    container.setAttribute('default-label', attributes.label)
    if (attributes.required) container.setAttribute('required', empty);
    if (attributes.name) container.setAttribute('name', attributes.name)


    const button = document.createElement('button')
    button.classList.add('select-button', 'input-container');

    const selectedValue = document.createElement('div')
    selectedValue.classList.add('selected-value', 'option-container')

    const labelContainer = document.createElement('div')
    labelContainer.classList.add('select-label-container')
    labelContainer.append(createStylisedLabel(attributes, false))

    selectedValue.append(labelContainer)
    button.append(selectedValue, utilityCreateIcon(attributes.arrow, ['input-icon', '--right', '--clickable-icon'])) // adapt the "--right" class


    const dropdown = document.createElement('div');
    dropdown.classList.add('select-dropdown');

    const innerDropdown = document.createElement('ul');
    innerDropdown.classList.add('select-inner-dropdown');
    innerDropdown.setAttribute('smooth-hover-effect', empty)
    dropdown.append(innerDropdown)

    attributes.options.forEach((checkbox) => {
        checkbox.type = 'checkbox'
        checkbox.box = true,
            checkbox.ghosted = true,
            checkbox.checkbox = attributes.checkbox
        checkbox.checkmark = attributes.checkmark
        checkbox.display = attributes.display
        checkbox.name = attributes.name
        checkbox.class = 'select-type'

        const option = document.createElement('li');
        option.classList.add('select-option');

        option.append(createCheckbox(checkbox))
        innerDropdown.append(option)
    })

    container.append(button, dropdown)

    return createContainerLabel([createStylisedLabel(attributes), container, createStylisedHelpText(attributes)], [attributes.parentClass], null, attributes);
}

function createTextarea(attributes) {
    const container = document.createElement('div');
    container.classList.add('textarea-container');

    // const input = createDefaultInput(attributes, 'textarea')

    const textarea = document.createElement('div');
    let labelFor = empty
    if (attributes.name) {
        container.setAttribute('name', attributes.name)
        labelFor = attributes.name
    }


    textarea.setAttribute('contenteditable', true)
    textarea.setAttribute('spellcheck', false)
    textarea.classList.add('textarea')

    const markupContainer = document.createElement('div');
    markupContainer.setAttribute('style', 'display: flex; gap: 8px; color: var(--grey);')
    markupContainer.append(
        utilityCreateButton([utilityCreateIcon('bold')], ['input-icon', '--clickable-icon'], { 'style': 'padding: 0px;', 'markup': 'bold' }),
        utilityCreateButton([utilityCreateIcon('italic')], ['input-icon', '--clickable-icon'], { 'style': 'padding: 0px;', 'markup': 'italic' }),
        utilityCreateButton([utilityCreateIcon('underline')], ['input-icon', '--clickable-icon'], { 'style': 'padding: 0px;', 'markup': 'underline' }),
        utilityCreateButton([utilityCreateIcon('strikethrough')], ['input-icon', '--clickable-icon'], { 'style': 'padding: 0px;', 'markup': 'strikethrough' }),
        utilityCreateButton([utilityCreateIcon('lowercase')], ['input-icon', '--clickable-icon'], { 'style': 'padding: 0px;', 'markup': 'lowercase' }),
        utilityCreateButton([utilityCreateIcon('uppercase')], ['input-icon', '--clickable-icon'], { 'style': 'padding: 0px;', 'markup': 'uppercase' })
    )

    container.append(markupContainer, textarea);

    return createContainerLabel([createStylisedLabel(attributes), container, createStylisedHelpText(attributes)], [attributes.parentClass], labelFor, attributes);
}

function createGroup(attributes) {
    // Define an empty string constant (used as a fallback)
    const empty = '';
  
    // Create the main container for the group.
    const container = document.createElement('div');
    container.classList.add('group');
  
    // If the group is only meant to act as an append zone, add specific classes and return.
    if (attributes.appendZone) {
      container.classList.add('ghosted', 'append-zone');
      return container;
    }
  
    // Add ghosted class if indicated.
    if (attributes.ghosted) {
      container.classList.add('ghosted');
    }
  
    // ----------------------------
    // Build the header section.
    // ----------------------------
    const headerContainer = document.createElement('div');
    headerContainer.style.display = 'flex';
    headerContainer.style.flexDirection = 'column';
  
    // Label
    const labelSpan = document.createElement('span');
    labelSpan.style.font = '700 27px var(--principal-font)';
    labelSpan.style.color = 'var(--dark-bg1)';
    labelSpan.textContent = attributes.label || '';
    headerContainer.appendChild(labelSpan);
  
    // Description
    const descriptionSpan = document.createElement('span');
    descriptionSpan.style.font = '400 13px var(--principal-font)';
    descriptionSpan.style.color = 'var(--grey)';
    descriptionSpan.textContent = attributes.description || '';
    headerContainer.appendChild(descriptionSpan);
  
    // Buttons for incrementing and decrementing if incrementGroup is true.
    const showButtons = Boolean(attributes.incrementGroup);
  
    const copyBtn = document.createElement('div');
    copyBtn.classList.add('button', 'copyAndIncrement');
    copyBtn.textContent = '+';
    if (!showButtons) {
      copyBtn.style.display = 'none';
    }
    headerContainer.appendChild(copyBtn);
  
    const decrementBtn = document.createElement('div');
    decrementBtn.classList.add('button', 'copyAndIncrement--decrement');
    decrementBtn.textContent = '-';
    if (!showButtons) {
      decrementBtn.style.display = 'none';
    }
    headerContainer.appendChild(decrementBtn);
  
    // Append the header to the container.
    container.appendChild(headerContainer);
  
    // ----------------------------
    // Build the content area.
    // ----------------------------
    const content = document.createElement('div');
    content.style.minHeight = '5px';
    content.style.width = '100%';
    content.style.display = 'flex';
    content.style.flexDirection = 'column';
    content.style.gap = '5px';
    container.appendChild(content);
  
    // ----------------------------
    // Helper function: analyze dropped elements.
    // This function updates attributes.incrementPattern with the config data
    // of all dropped elements.
    // ----------------------------
    function analyzeElementsDropped() {
      const droppedElements = container.querySelectorAll('.droppedElementUnderGroup');
      // Initialize or clear the incrementPattern array.
      attributes.incrementPattern = [];
      droppedElements.forEach(child => {
        const firstChild = child.firstElementChild;
        if (firstChild) {
          const configStr = firstChild.getAttribute('config');
          if (configStr) {
            try {
              const configObj = JSON.parse(configStr);
              attributes.incrementPattern.push(configObj);
            } catch (e) {
              console.error('Failed to parse config attribute:', e);
            }
          }
        }
      });
    }
  
    // ----------------------------
    // Setup dropzone functionality.
    // ----------------------------
    if (attributes.sensitiveToDrop) {
      // Set additional attributes on the content element.
      content.setAttribute('jsname', 'group-dropzone');
      content.setAttribute('inner-dropzone', empty);
  
      // Prevent default behavior for dragover.
      container.addEventListener('dragover', function (event) {
        event.preventDefault();
        event.stopPropagation();
      });
  
      // Handle the drop event.
      container.addEventListener('drop', function (event) {
        event.preventDefault();
        event.stopPropagation();
  
        let data;
        try {
          data = JSON.parse(event.dataTransfer.getData('text/plain'));
        } catch (e) {
          console.error('Error parsing drop data:', e);
          return;
        }
        if (!data || !data.dragname || !data.size) {
          console.error('Incomplete drop data.');
          return;
        }
  
        // Create the new element using the provided defaultWidget function.
        const newElement = defaultWidget(data.dragname);
  
        // Calculate dimensions using assumed global gridSize values.
        const [gridWidth, gridHeight] = data.size.split('x').map(Number);
        newElement.style.height = (gridSizeH * gridHeight) + 'px';
        newElement.style.width = (gridSizeW * gridWidth) + 'px';
  
        newElement.classList.add('droppedElementUnderGroup');
        newElement.style.position = 'relative';
        newElement.style.width = '100%';
  
        // Append the new element to the content area.
        content.appendChild(newElement);
  
        // Update the increment pattern.
        analyzeElementsDropped();
      });
    }
  
    // ----------------------------
    // Setup increment and decrement functionality.
    // ----------------------------
    if (attributes.incrementGroup) {
      // Increment (copy) functionality.
      copyBtn.addEventListener('click', () => {
        analyzeElementsDropped();
        if (Array.isArray(attributes.incrementPattern)) {
          attributes.incrementPattern.forEach(element => {
            // Create a new stylised input using the assumed global function.
            const stylisedInput = createStylisedInput(element);
            stylisedInput.classList.add('copied-element');
  
            // Determine insertion point.
            const lastCopied = content.querySelector('.copied-element:last-of-type');
            const baseElement = content.querySelector('.base-element:last-of-type');
  
            if (lastCopied && lastCopied.parentNode) {
              lastCopied.parentNode.insertBefore(stylisedInput, lastCopied.nextSibling);
            } else if (baseElement && baseElement.parentNode) {
              baseElement.parentNode.insertBefore(stylisedInput, baseElement.nextSibling);
            } else {
              content.appendChild(stylisedInput);
            }
          });
        }
      });
  
      // Decrement (remove) functionality.
      decrementBtn.addEventListener('click', () => {
        const lastCopied = content.querySelector('.copied-element:last-of-type');
        if (lastCopied) {
          lastCopied.remove();
        }
      });
    }
  
    // ----------------------------
    // Add provided group content.
    // ----------------------------
    if (Array.isArray(attributes.groupContent)) {
      attributes.groupContent.forEach(element => {
        const innerContent = createStylisedInput(element);
        content.appendChild(innerContent);
      });
    }
  
    return container;
  }
  


function createNotInput(attributes){
    const container = document.createElement('div')

    if(attributes.value) container.textContent = attributes.value
    if(attributes.class) [].concat(attributes.class).filter(Boolean).forEach(classValue => container.classList.add(classValue));
    if(attributes.style) container.setAttribute('style', attributes.style)

    return container
}

function createButton(attributes) {
    // Create the button with the specified classes
    const button = utilityCreateButton([], [].concat(attributes.class));

    // Set the label if provided
    if (attributes.label) button.textContent = attributes.label;

    // Attach the action from the registry
    if (attributes.action && actionRegistry[attributes.action]) {
        button.addEventListener('click', () => {
            actionRegistry[attributes.action](attributes.args || {}); // Pass args if provided
        });
    } else if (attributes.action) {
        console.error(
            `Action "${attributes.action}" is not registered. Please add it to the action registry.`
        );
    }

    return button;
}


function utilityCreateButton(inner = [], className = [empty], attributes = {}) {
    const button = document.createElement('button');
    button.type = "button"

    inner
        .filter(Boolean)  // Filters out any falsy values in array
        .forEach(i => button.append(i));

    className
        .filter(Boolean)  // Filters out any falsy values in array
        .forEach(classValue => button.classList.add(classValue));

    for (const [attrName, attrValue] of Object.entries(attributes)) {
        if (attrValue) button.setAttribute(attrName, attrValue);
    }
    return button;
}

function utilityCreateIcon(iconName, className = ['icon'], attributes = {}) {
    const span = document.createElement('span');
    for (const classValue of className) {
        span.classList.add(classValue)
    }
    span.innerHTML = iconMap[iconName] || iconMap['default'];
    for (const [attrName, attrValue] of Object.entries(attributes)) {
        if (attrValue) span.setAttribute(attrName, attrValue);
    }
    return span;
}



/* ******************************************************************************************************************************************************************
******************************************************************************************************************************************************************

Functionnality functions (hide password, incrementer/decrementer buttons, custom select dropdown, ...)

******************************************************************************************************************************************************************
****************************************************************************************************************************************************************** */
function togglePasswordVisibility(icon, type = 'text') {                   // Refactor
    const input = icon.parentElement.querySelector('input');
    input.type = input.type === 'password' ? type : 'password';
    const svgs = icon.querySelectorAll('span')
    svgs[0].style.display = input.type === 'password' ? 'block' : 'none';
    svgs[1].style.display = input.type === 'password' ? 'none' : 'block';
}

function numberInputControl(self, mode) {
    const input = self.parentElement.querySelector('input[type="number"]');
    if (mode == "decrement") {
        input.stepDown();
    } else {
        input.stepUp();
    }
}

function NumberInputsController() {
    document.querySelectorAll('[numberInputControl]').forEach(operator => {
        operator.addEventListener('mousedown', function (event) {
            startContinuousControl(operator, operator.getAttribute('numberInputControl'), event);
        });
        operator.addEventListener('mouseup', stopContinuousControl);
        operator.addEventListener('mouseleave', stopContinuousControl);
    });
}

let intervalId;
let speedTimeoutId;
let currentInterval = 100; // Initial interval time
const normalSpeed = 100;
const fastSpeed = 50;
function startContinuousControl(icon, mode, event) {
    const evt = event || window.event;
    if ("buttons" in evt) {
        if (evt.buttons == 1) {
            numberInputControl(icon, mode); // Call once immediately
            intervalId = setInterval(() => {
                numberInputControl(icon, mode);
            }, currentInterval); // Initial speed

            // Set a timeout to increase the speed after 5 seconds
            speedTimeoutId = setTimeout(() => {
                clearInterval(intervalId); // Clear the current interval
                currentInterval = fastSpeed; // Increase the speed
                intervalId = setInterval(() => {
                    numberInputControl(icon, mode);
                }, currentInterval); // Set the new faster interval
            }, 1000); // 5 seconds
        }
    }

}

function stopContinuousControl() {
    clearInterval(intervalId);
    clearTimeout(speedTimeoutId); // Clear the speed increase timeout
    currentInterval = normalSpeed; // Reset to normal speed
}

function initCustomSelect() {
    document.querySelectorAll('.select-container').forEach((customSelect) => {
        if (!customSelect.getAttribute('handled')) {

            customSelect.setAttribute('handled', '')
            const selectBtn = customSelect.querySelector(".select-button");
            const selectedValue = customSelect.querySelector(".selected-value");
            const optionsList = customSelect.querySelectorAll(".select-dropdown .select-option");

            function closeAllSelects(exceptSelect = null) {
                document.querySelectorAll('.select-container.active').forEach((openSelect) => {
                    if (openSelect !== exceptSelect) {
                        openSelect.classList.remove("active");
                    }
                });
            }

            // Toggle the active class on the container when select button is clicked
            selectBtn.addEventListener("click", (e) => {
                e.stopPropagation(); // Prevents click event from bubbling up and closing the dropdown
                closeAllSelects(customSelect);
                customSelect.classList.toggle("active");
            });

            // Function to handle option selection
            function handleOptionSelection(option) {
                let defaultValue = customSelect.getAttribute('default-label')
                // Check if the select is a multi-select or a single-select
                if (customSelect.getAttribute('type') === "multi-select") {
                    // Find all the checked options within the custom select
                    let selectedOptions = customSelect.querySelectorAll('.option-container input[type="checkbox"]:checked');
                    // Clear the selectedValue container before adding new elements
                    selectedValue.innerHTML = "";

                    if (selectedOptions.length > 0) {
                        // Create a document fragment to improve performance when appending multiple elements
                        let fragment = document.createDocumentFragment();

                        // Loop through each checked option and add its value to the fragment
                        selectedOptions.forEach(function (checkedOption) {
                            // Create a new div for each selected option
                            let container = document.createElement('div');
                            let clone = checkedOption.closest('.option-container').cloneNode(true);

                            container.classList.add('select-tag');
                            clone.querySelector('.option').remove(); // Remove unnecessary parts (like the checkbox)
                            container.innerHTML = clone.innerHTML.trim();

                            // Append the container to the document fragment
                            fragment.appendChild(container);
                        });

                        // Append all selected option containers to the selectedValue element
                        selectedValue.appendChild(fragment);
                    }
                    else {
                        let defaultLabel = document.createElement('span')
                        defaultLabel.classList.add('input-label')
                        defaultLabel.textContent = defaultValue
                        selectedValue.appendChild(defaultLabel)
                    }

                } else {
                    // Single-select behavior
                    let container = document.createElement('div');
                    let clone = option.querySelector('.option-container').cloneNode(true);

                    container.classList.add('select-label-container');
                    clone.querySelector('.option').remove(); // Remove unnecessary parts (like the radio button)
                    container.innerHTML = clone.innerHTML.trim();

                    // Clear the selectedValue container and append the single selected option
                    selectedValue.innerHTML = "";
                    selectedValue.appendChild(container);
                }

                // If it's not multi-select, close the custom select dropdown
                if (!(customSelect.getAttribute('type') === "multi-select")) {
                    customSelect.classList.remove("active");
                }
            }



            // Add event listeners for each option
            optionsList.forEach((option) => {
                option.addEventListener("click", (e) => {
                    handleOptionSelection(option);
                });

                option.addEventListener("keyup", (e) => {
                    if (e.key === "Enter") {
                        handleOptionSelection(option);
                    }
                });
            });

            // Close the dropdown when clicking outside the container
            document.addEventListener("click", (e) => {
                if (!customSelect.contains(e.target)) {
                    customSelect.classList.remove("active");
                }
            });
        }

    })
}

function handleFunctionnalityFunctions() {
    NumberInputsController()
    initCustomSelect()
    initSmoothHoverEffect()
    initTooltip()
}

document.addEventListener('DOMContentLoaded', inputStyler)
document.addEventListener('DOMContentLoaded', iconSetter)

// // Set up the MutationObserver to watch for changes in the document
// const inputObserver = new MutationObserver((mutationsList, observer) => {
//     // Execute inputStyler function only if elements with the "istyler" attribute are detected
//     inputStyler();
// });

// // Start observing the document for changes
// inputObserver.observe(document, {
//     childList: true,
//     subtree: true,
//     attributes: true
// });


/* ******************************************************************************************************************************************************************
******************************************************************************************************************************************************************

Button's authorized functions

******************************************************************************************************************************************************************
****************************************************************************************************************************************************************** */

// Action registry to map string keys to functions
const actionRegistry = {
    "options-dataset-overlay": (args) => optionsDatasetOverlay(args),
    "show-alert": (args) => alert(args.message || "Default alert!"),
    // Add more actions here
};

function optionsDatasetOverlay(arg){
    console.log(arg, 'is a', typeof(arg))
}
