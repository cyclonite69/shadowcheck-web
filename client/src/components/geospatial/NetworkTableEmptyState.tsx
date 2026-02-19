interface NetworkTableEmptyStateProps {
  loading: boolean;
  empty: boolean;
  error: string | null;
  colSpan: number;
}

export const NetworkTableEmptyState = ({
  loading,
  empty,
  error,
  colSpan,
}: NetworkTableEmptyStateProps) => {
  if (!loading && !empty) return null;

  if (loading) {
    return (
      <tr>
        <td colSpan={colSpan} style={{ padding: '12px', textAlign: 'center', color: '#94a3b8' }}>
          Loading networks…
        </td>
      </tr>
    );
  }

  if (empty) {
    return (
      <tr>
        <td colSpan={colSpan} style={{ padding: '12px', textAlign: 'center', color: '#94a3b8' }}>
          {error ? `Error: ${error}` : 'No networks match current filters'}
        </td>
      </tr>
    );
  }

  return null;
};
