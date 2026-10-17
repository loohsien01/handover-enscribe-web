/**
 * Sidebar panel mark from `public/icons/sidebar.svg`, tinted via CSS mask.
 */
export default function IconSidebar({ className = 'h-5 w-5' }) {
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 bg-current [mask-image:url('/icons/sidebar.svg')] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain] [-webkit-mask-image:url('/icons/sidebar.svg')] [-webkit-mask-position:center] [-webkit-mask-repeat:no-repeat] [-webkit-mask-size:contain] ${className}`}
    />
  );
}
