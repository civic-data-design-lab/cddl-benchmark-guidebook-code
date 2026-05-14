export default function StatusMessage({ status }) {
  if (!status?.message) {
    return null;
  }

  return (
    <div className={`status-message ${status.type || 'info'}`} role="status">
      <pre>{status.message}</pre>
      {status.detail ? (
        <details>
          <summary>Technical details</summary>
          <pre>{status.detail}</pre>
        </details>
      ) : null}
    </div>
  );
}
