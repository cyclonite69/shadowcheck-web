import React, { useEffect } from 'react';
import { ObservationsCard } from '../components/ObservationsCard';
import { useWigleSearch } from '../hooks/useWigleSearch';
import { useWigleRuns } from '../hooks/useWigleRuns';
import { useWigleBluetooth } from '../hooks/useWigleBluetooth';
import { useWigleSavedTerms } from '../hooks/useWigleSavedTerms';
import { useWigleCoverage } from '../hooks/useWigleCoverage';
import { WigleCoverageCard } from './wigle-search/WigleCoverageCard';
import { WigleSearchTypeToggle } from './wigle-search/WigleSearchTypeToggle';
import { WigleNetworkFiltersCard } from './wigle-search/WigleNetworkFiltersCard';
import { WigleExecuteSearchCard } from './wigle-search/WigleExecuteSearchCard';
import { WigleSearchResultsCard } from './wigle-search/WigleSearchResultsCard';
import { WigleImportRunsSection } from './wigle-search/WigleImportRunsSection';
import type { WigleNetworkResult } from '../../../types/admin';

export const WigleSearchTab: React.FC = () => {
  const {
    apiStatus,
    searchLoading,
    searchResults,
    searchError,
    searchParams,
    setSearchParams,
    loadApiStatus,
    runSearch,
    importAllResults,
    loadMoreResults,
    hasMorePages,
    currentPage: _currentPage,
    totalPages: _totalPages,
    totalResults,
    loadedCount,
    selectedNetwork,
    setSelectedNetwork,
    scrollRef,
  } = useWigleSearch();

  const [searchType, setSearchType] = React.useState<'wifi' | 'bluetooth'>('wifi');

  const {
    runs,
    report: _report,
    loading: runsLoading,
    error: runsError,
    actionLoading,
    sortCols: runsSortCols,
    setSortCols: setRunsSortCols,
    refresh: refreshRuns,
    resumeRun,
    pauseRun,
    cancelRun,
    deleteRun,
  } = useWigleRuns({ limit: 100 });

  const { btParams, setBtParams, btImportLoading, btImportError, importAllBluetooth } =
    useWigleBluetooth({
      searchParams,
      refreshRuns,
    });

  const { savedTerms, ssidDropdownOpen, setSsidDropdownOpen, saveCurrentSsid, deleteSavedTerm } =
    useWigleSavedTerms({
      ssid: searchParams.ssid,
    });

  const { coverageTerms, coverageTerm, setCoverageTerm, termReport, termReportLoading } =
    useWigleCoverage({
      runs,
    });

  const ssidInputRef = React.useRef<HTMLInputElement>(null);

  const handleRowClick = (net: WigleNetworkResult) => {
    const bssid = (net as any).netid || (net as any).bssid;
    setSelectedNetwork((prev: any) => (prev && (prev.netid || prev.bssid) === bssid ? null : net));
  };

  useEffect(() => {
    loadApiStatus();
  }, []);

  return (
    <div className="space-y-4">
      {/* 1. WiGLE Coverage by State */}
      <WigleCoverageCard
        coverageTerms={coverageTerms}
        coverageTerm={coverageTerm}
        setCoverageTerm={setCoverageTerm}
        termReport={termReport}
        termReportLoading={termReportLoading}
      />

      {/* 2. Search Type Toggle */}
      <WigleSearchTypeToggle searchType={searchType} setSearchType={setSearchType} />

      {/* 3. Network & Geo Filters */}
      <WigleNetworkFiltersCard
        searchType={searchType}
        searchParams={searchParams}
        setSearchParams={setSearchParams}
        btParams={btParams}
        setBtParams={setBtParams}
        savedTerms={savedTerms}
        ssidDropdownOpen={ssidDropdownOpen}
        setSsidDropdownOpen={setSsidDropdownOpen}
        deleteSavedTerm={deleteSavedTerm}
        ssidInputRef={ssidInputRef}
      />

      {/* 4 & 5. Execute Search (2/5) | Search Results (3/5) */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <WigleExecuteSearchCard
          searchType={searchType}
          searchLoading={searchLoading}
          apiStatus={apiStatus}
          runSearch={runSearch}
          saveCurrentSsid={saveCurrentSsid}
          importAllResults={importAllResults}
          importAllBluetooth={importAllBluetooth}
          btImportLoading={btImportLoading}
          btImportError={btImportError}
          searchError={searchError}
        />

        <WigleSearchResultsCard
          searchResults={searchResults}
          totalResults={totalResults}
          loadedCount={loadedCount}
          scrollRef={scrollRef}
          selectedNetwork={selectedNetwork}
          handleRowClick={handleRowClick}
          searchLoading={searchLoading}
          hasMorePages={hasMorePages}
          loadMoreResults={loadMoreResults}
        />
      </div>

      {/* Observations Card — populated when a network row is clicked */}
      <ObservationsCard selectedNetwork={selectedNetwork} />

      {/* 6. WiGLE Import Runs Section */}
      <WigleImportRunsSection
        runs={runs}
        runsLoading={runsLoading}
        actionLoading={actionLoading}
        runsError={runsError}
        runsSortCols={runsSortCols}
        setRunsSortCols={setRunsSortCols}
        refreshRuns={refreshRuns}
        resumeRun={resumeRun}
        pauseRun={pauseRun}
        cancelRun={cancelRun}
        deleteRun={deleteRun}
      />
    </div>
  );
};
