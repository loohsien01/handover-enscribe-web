/**
 * Visit prep mark from `public/icons/visit prep.svg`, tinted via CSS mask.
 */
export default function IconVisitPrep({ className = 'h-6 w-6' }) {
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 bg-[#183278] [mask-image:url('/icons/visit%20prep.svg')] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain] [-webkit-mask-image:url('/icons/visit%20prep.svg')] [-webkit-mask-position:center] [-webkit-mask-repeat:no-repeat] [-webkit-mask-size:contain] ${className}`}
    />
  );
}
