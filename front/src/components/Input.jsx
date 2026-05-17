export default function Input({ placeholder }) {
  return (
    <input
      type="text"
      placeholder={placeholder}
      style={{
        width: '100%',
        marginBottom: '0.75rem',
        padding: '0.5rem 0.75rem',
        borderRadius: '0.25rem',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        color: 'white',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        outline: 'none'
      }}
    />
  );
}