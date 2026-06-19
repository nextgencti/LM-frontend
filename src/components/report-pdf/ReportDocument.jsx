import React from 'react';
import { Document, View, Text } from '@react-pdf/renderer';
import { getStyles } from './styles';
import ReportPage from './ReportPage';
import PatientInfoSection from './PatientInfoSection';
import TestCategorySection from './TestCategorySection';
import ParameterTable from './ParameterTable';
import WidalTable from './WidalTable';
import SignatureSection from './SignatureSection';

export default function ReportDocument({ reportData, labProfile, patientData, doctorData, bookingData, qrUrl }) {
  const styles = getStyles(labProfile);
  const results = reportData?.results || [];

  // Group parameters by test name, then by group name (same as backend reduction)
  const nestedResults = results.reduce((acc, curr) => {
    const t = curr._testName || reportData?.testName?.split(',')[0]?.trim() || 'General';
    const g = curr.groupName || 'General';
    if (!acc[t]) acc[t] = {};
    if (!acc[t][g]) acc[t][g] = [];
    acc[t][g].push(curr);
    return acc;
  }, {});

  // Separate standard results from grid/tabular/Widal results
  const standardResults = [];
  const otherResults = [];

  Object.entries(nestedResults).forEach(([testTit, grpData]) => {
    const isWidal = testTit.toUpperCase().includes('WIDAL');
    const firstGrp = Object.values(grpData)[0] || [];
    const firstP = firstGrp[0] || {};
    const isGrid = firstP.dataType === 'Grid' || 
                   firstP.dataType === 'Titer' || 
                   isWidal || 
                   reportData?.reportLayout === 'Tabular table';

    if (isGrid) {
      otherResults.push([testTit, grpData]);
    } else {
      standardResults.push([testTit, grpData]);
    }
  });

  return (
    <Document title={`${reportData?.patientName || 'Patient'}_Report`}>
      <ReportPage labProfile={labProfile} qrUrl={qrUrl} styles={styles}>
        
        {/* 1. Patient Information (Only on first page, flows naturally) */}
        <PatientInfoSection
          reportData={reportData}
          patientData={patientData}
          doctorData={doctorData}
          bookingData={bookingData}
          qrUrl={qrUrl}
          styles={styles}
        />

        {/* 2. Parameters List Section */}
        {results.length === 0 ? (
          <Text style={styles.noResultsText}>No Results Finalized Yet</Text>
        ) : (
          <View style={{ flexGrow: 1 }}>
            {/* Standard Results Container with repeating fixed header */}
            {standardResults.length > 0 && (
              <View style={{ flexGrow: 1 }} wrap={true}>
                {/* Global Standard Header (marked fixed to repeat once per page where standard parameters flow) */}
                <View style={styles.standardTableHeader} fixed>
                  <Text style={[styles.colParam, styles.headerText]}>Parameter</Text>
                  <Text style={[styles.colResult, styles.headerText]}>Result</Text>
                  <Text style={[styles.colFlag, styles.headerText, { textAlign: 'center' }]}>Flag</Text>
                  <Text style={[styles.colUnit, styles.headerText]}>Unit</Text>
                  <Text style={[styles.colRange, styles.headerText, { textAlign: 'right' }]}>Ref. Range</Text>
                </View>

                {standardResults.map(([testTit, grpData], idx) => {
                  const firstGrp = Object.values(grpData)[0] || [];
                  const firstP = firstGrp[0] || {};
                  const catName = firstP._category || 'General';
                  const samType = firstP._sampleType || 'N/A';

                  return (
                    <View key={idx} style={{ marginBottom: 10 }} wrap={false}>
                      {/* Category Header */}
                      <TestCategorySection
                        testTit={testTit}
                        catName={catName}
                        samType={samType}
                        styles={styles}
                      />

                      {/* Parameter Groups under this test */}
                      {Object.entries(grpData).map(([grpN, params], gIdx) => (
                        <View key={gIdx} style={{ marginTop: 2, marginBottom: 4 }} wrap={false}>
                          {grpN && grpN.toUpperCase() !== 'GENERAL' ? (
                            <View style={styles.groupHeaderContainer}>
                              <Text style={styles.groupHeaderText}>{grpN}</Text>
                              <View style={styles.groupHeaderLine} />
                            </View>
                          ) : null}
                          <ParameterTable params={params} isTabular={false} styles={styles} />
                        </View>
                      ))}
                    </View>
                  );
                })}
              </View>
            )}

            {/* Other Results (Widal / Grid / Tabular layouts) */}
            {otherResults.map(([testTit, grpData], idx) => {
              const firstGrp = Object.values(grpData)[0] || [];
              const firstP = firstGrp[0] || {};
              const catName = firstP._category || 'General';
              const samType = firstP._sampleType || 'N/A';

              return (
                <View key={idx} style={{ marginBottom: 10 }} wrap={false}>
                  {/* Category Header */}
                  <TestCategorySection
                    testTit={testTit}
                    catName={catName}
                    samType={samType}
                    styles={styles}
                  />

                  {/* Parameter Groups under this test */}
                  {Object.entries(grpData).map(([grpN, params], gIdx) => {
                    const isWidal = testTit.toUpperCase().includes('WIDAL') || grpN.toUpperCase().includes('WIDAL');
                    const isGrid = params[0]?.dataType === 'Grid' || params[0]?.dataType === 'Titer' || isWidal;
                    const isTabular = reportData?.reportLayout === 'Tabular table';

                    return (
                      <View key={gIdx} style={{ marginTop: 2, marginBottom: 4 }} wrap={false}>
                        {grpN && grpN.toUpperCase() !== 'GENERAL' ? (
                          <View style={styles.groupHeaderContainer}>
                            <Text style={styles.groupHeaderText}>{grpN}</Text>
                            <View style={styles.groupHeaderLine} />
                          </View>
                        ) : null}

                        {isGrid ? (
                          <WidalTable params={params} styles={styles} />
                        ) : isTabular ? (
                          <ParameterTable params={params} isTabular={true} styles={styles} />
                        ) : (
                          <ParameterTable params={params} isTabular={false} styles={styles} />
                        )}
                      </View>
                    );
                  })}
                </View>
              );
            })}
          </View>
        )}

        {/* 3. Pathologist Signature Block (Only at end, flows naturally) */}
        <SignatureSection labProfile={labProfile} styles={styles} />

        {/* 4. End of Report Block (Only at end, flows naturally) */}
        <View style={styles.endOfReportContainer} wrap={false}>
          <View style={styles.endOfReportTitleRow}>
            <View style={styles.endOfReportLine} />
            <Text style={styles.endOfReportTitle}>End of Report</Text>
            <View style={styles.endOfReportLine} />
          </View>
          <Text style={styles.endOfReportText}>
            This is an electronically generated report. Clinical correlation is recommended.
          </Text>
          <Text style={styles.printedOnText}>
            Printed On: {new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
          </Text>
        </View>

      </ReportPage>
    </Document>
  );
}
