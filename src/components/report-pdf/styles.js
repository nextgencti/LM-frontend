import { StyleSheet, Font } from '@react-pdf/renderer';

// Register Inter font weights from gstatic TTF files
Font.register({
  family: 'Inter',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuI6fMZg.ttf', fontWeight: 500 },
    { src: 'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZg.ttf', fontWeight: 700 },
    { src: 'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuBWYMZg.ttf', fontWeight: 900 }
  ]
});

export const getStyles = (labProfile) => {
  const headerMode = labProfile?.reportSettings?.headerMode || 'text';
  const footerMode = labProfile?.reportSettings?.footerMode || 'text';
  
  const paddingTop = headerMode === 'none' ? 45 : (headerMode === 'custom' ? 135 : 120);
  const paddingBottom = footerMode === 'none' ? 60 : (footerMode === 'custom' ? 110 : 100);

  return StyleSheet.create({
    page: {
      paddingTop,
      paddingBottom,
      paddingHorizontal: 35,
      fontFamily: 'Inter',
      fontSize: 9,
      color: '#111827',
      backgroundColor: '#ffffff',
    },
    
    // Watermark
    watermarkContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: -10,
    },
    watermarkTextBorder: {
      borderWidth: 4,
      borderColor: '#111827',
      paddingHorizontal: 25,
      paddingVertical: 12,
      textTransform: 'uppercase',
    },
    watermarkText: {
      fontFamily: 'Inter',
      fontWeight: 900,
      letterSpacing: 4,
      color: '#111827',
      textAlign: 'center',
    },

    // Header Styles
    headerContainer: {
      position: 'absolute',
      top: 20,
      left: 35,
      right: 35,
      zIndex: 20,
    },
    headerContainerCustom: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 20,
    },
    headerImage: {
      width: '100%',
      height: 'auto',
    },
    headerTextRow: {
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      paddingBottom: 6,
    },
    labName: {
      fontFamily: 'Inter',
      fontWeight: 900,
      fontSize: 30,
      color: '#064e3b', // emerald-900
      textTransform: 'uppercase',
      marginBottom: 3,
    },
    labDetail: {
      fontFamily: 'Inter',
      fontWeight: 700,
      fontSize: 11,
      color: '#374151', // gray-700
      marginTop: 1,
    },
    reportBadgeContainer: {
      backgroundColor: '#ecfdf5', // emerald-50
      borderWidth: 1,
      borderColor: '#a7f3d0', // emerald-200
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
      alignSelf: 'flex-start',
    },
    reportBadgeText: {
      fontFamily: 'Inter',
      fontWeight: 900,
      fontSize: 9,
      color: '#064e3b',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    headerLine: {
      height: 2.5,
      backgroundColor: '#064e3b',
      marginTop: 2,
    },

    // Footer Styles
    footerContainer: {
      position: 'absolute',
      bottom: 20,
      left: 35,
      right: 35,
      zIndex: 20,
    },
    footerContainerCustom: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 20,
    },
    footerImage: {
      width: '100%',
      height: 'auto',
    },
    footerContent: {
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
    },
    footerSignatoryBlock: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
    },
    signatoryLine: {
      width: 130,
      height: 1,
      backgroundColor: '#111827',
      marginBottom: 3,
    },
    signatoryTitle: {
      fontFamily: 'Inter',
      fontWeight: 900,
      fontSize: 9,
      color: '#111827',
      textTransform: 'uppercase',
    },
    signatorySub: {
      fontFamily: 'Inter',
      fontWeight: 700,
      fontSize: 7,
      color: '#9ca3af',
      textTransform: 'uppercase',
      marginTop: 1,
    },

    // Patient Info Styles
    patientInfoContainer: {
      borderWidth: 1,
      borderColor: '#d1d5db',
      borderRadius: 6,
      padding: 8,
      display: 'flex',
      flexDirection: 'row',
      marginBottom: 12,
      marginTop: 8,
    },
    patientInfoGrid: {
      flex: 1,
      display: 'flex',
      flexDirection: 'row',
      gap: 12,
    },
    gridColumn: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: 3,
    },
    infoRow: {
      display: 'flex',
      flexDirection: 'row',
    },
    infoLabel: {
      width: 85,
      color: '#6b7280',
      fontFamily: 'Inter',
      fontWeight: 500,
      textTransform: 'uppercase',
      fontSize: 9,
    },
    infoValue: {
      flex: 1,
      color: '#111827',
      fontFamily: 'Inter',
      fontWeight: 700,
      fontSize: 9,
    },
    qrColumn: {
      width: 80,
      borderLeftWidth: 1,
      borderLeftColor: '#e5e7eb',
      paddingLeft: 8,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
    },
    qrCodeImage: {
      width: 50,
      height: 50,
    },
    qrLabel: {
      fontFamily: 'Inter',
      fontWeight: 500,
      fontSize: 6,
      color: '#9ca3af',
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginTop: 2,
      textAlign: 'center',
    },

    // Test Category Section
    testCategoryHeader: {
      backgroundColor: '#f0fdf4',
      borderLeftWidth: 3,
      borderLeftColor: '#059669',
      paddingHorizontal: 8,
      paddingVertical: 4,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 8,
      marginBottom: 4,
    },
    testCategoryHeaderLeft: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 6,
    },
    testTitleText: {
      fontFamily: 'Inter',
      fontWeight: 700,
      fontSize: 10.5,
      color: '#064e3b',
      textTransform: 'uppercase',
    },
    testCategoryText: {
      fontFamily: 'Inter',
      fontWeight: 700,
      fontSize: 8,
      color: '#1e3a8a',
      opacity: 0.5,
      borderLeftWidth: 1,
      borderLeftColor: '#d1d5db',
      paddingLeft: 5,
    },
    testSampleText: {
      fontFamily: 'Inter',
      fontWeight: 500,
      fontSize: 8,
      color: '#9ca3af',
      textTransform: 'uppercase',
    },

    // Standard Parameter Table Styles
    standardTableContainer: {
      width: '100%',
      marginTop: 2,
      marginBottom: 6,
    },
    standardTableHeader: {
      display: 'flex',
      flexDirection: 'row',
      borderBottomWidth: 1.5,
      borderBottomColor: '#6b7280',
      backgroundColor: '#f3f4f6',
      paddingVertical: 2.5,
      paddingHorizontal: 6,
    },
    standardTableRow: {
      display: 'flex',
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: '#f3f4f6',
      paddingVertical: 2.5,
      paddingHorizontal: 6,
    },
    
    // Tabular / Boxed Table Styles
    tabularTableContainer: {
      width: '100%',
      borderWidth: 1,
      borderColor: '#6b7280',
      marginTop: 4,
      marginBottom: 8,
    },
    tabularTableHeader: {
      display: 'flex',
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: '#6b7280',
      backgroundColor: '#f3f4f6',
      paddingVertical: 3,
      paddingHorizontal: 6,
    },
    tabularTableRow: {
      display: 'flex',
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: '#6b7280',
      paddingVertical: 3,
      paddingHorizontal: 6,
    },

    colParam: { width: '35%', fontSize: 10 },
    colResult: { width: '15%', fontSize: 10 },
    colFlag: { width: '10%', fontSize: 10 },
    colUnit: { width: '15%', fontSize: 10, color: '#6b7280' },
    colRange: { width: '25%', fontSize: 10 },
    
    colWidalParam: { width: '40%', fontSize: 10 },
    colWidalTiter: { width: '12%', fontSize: 10 },

    headerText: {
      fontFamily: 'Inter',
      fontWeight: 700,
      fontSize: 10,
      color: '#4b5563',
      textTransform: 'uppercase',
    },
    textBold: {
      fontFamily: 'Inter',
      fontWeight: 700,
      color: '#111827',
    },
    textMedium: {
      fontFamily: 'Inter',
      fontWeight: 500,
      color: '#374151',
    },

    // Group Header
    groupHeaderContainer: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
      marginBottom: 2,
      paddingHorizontal: 6,
    },
    groupHeaderText: {
      fontFamily: 'Inter',
      fontWeight: 700,
      fontSize: 10,
      color: '#1e3a8a',
      backgroundColor: '#f8fafc',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderLeftWidth: 2,
      borderLeftColor: '#60a5fa',
      textTransform: 'uppercase',
    },
    groupHeaderLine: {
      height: 1,
      backgroundColor: '#f1f5f9',
      flexGrow: 1,
      marginLeft: 4,
      opacity: 0.5,
    },

    // Pathologist Signature
    signatureContainer: {
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: 15,
      marginBottom: 8,
      paddingRight: 6,
    },
    signatureBlock: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      minWidth: 130,
    },
    signatureImage: {
      height: 35,
      width: 'auto',
      marginBottom: 3,
    },
    signatureLine: {
      width: 130,
      height: 1,
      backgroundColor: '#111827',
      marginBottom: 2,
    },
    signatureName: {
      fontFamily: 'Inter',
      fontWeight: 900,
      fontSize: 9,
      color: '#111827',
      textTransform: 'uppercase',
      textAlign: 'center',
    },
    signatureDesignation: {
      fontFamily: 'Inter',
      fontWeight: 700,
      fontSize: 7,
      color: '#6b7280',
      textTransform: 'uppercase',
      marginTop: 1,
      textAlign: 'center',
    },

    // End of Report
    endOfReportContainer: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      marginTop: 20,
      marginBottom: 10,
    },
    endOfReportTitleRow: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginBottom: 4,
    },
    endOfReportLine: {
      height: 1,
      width: 50,
      backgroundColor: '#e5e7eb',
    },
    endOfReportTitle: {
      fontFamily: 'Inter',
      fontWeight: 900,
      fontSize: 8.5,
      color: '#111827',
      textTransform: 'uppercase',
      letterSpacing: 2,
    },
    endOfReportText: {
      fontFamily: 'Inter',
      fontWeight: 500,
      fontSize: 7,
      color: '#9ca3af',
      textAlign: 'center',
    },
    printedOnText: {
      fontFamily: 'Inter',
      fontWeight: 700,
      fontSize: 7,
      color: '#9ca3af',
      textTransform: 'uppercase',
      marginTop: 2,
      textAlign: 'center',
    },

    // Utilities
    noResultsText: {
      fontFamily: 'Inter',
      fontWeight: 700,
      fontSize: 10,
      color: '#9ca3af',
      textTransform: 'uppercase',
      letterSpacing: 1.5,
      textAlign: 'center',
      paddingVertical: 50,
      borderWidth: 2,
      borderColor: '#f3f4f6',
      borderStyle: 'dashed',
      borderRadius: 10,
      marginVertical: 10,
    }
  });
};
