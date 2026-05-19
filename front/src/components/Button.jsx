export default function Button({ text, primary, dark }) {
  let style = {
    backgroundColor: '#6b7280',
    color: 'white'
  };

  if (primary) style = {
    backgroundColor: '#d1d5db',
    color: 'black'
  };
  if (dark) style = {
    backgroundColor: '#374151',
    color: 'white'
  };

  return (
    <button style={{
      width: '100%',
      padding: '0.5rem 0',
      marginBottom: '0.5rem',
      borderRadius: '0.25rem',
      ...style,
      opacity: 0.8
    }} onMouseEnter={(e) => e.target.style.opacity = '0.8'} onMouseLeave={(e) => e.target.style.opacity = '1'}>
      {text}
    </button>
  );
}