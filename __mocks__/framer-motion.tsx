// Mock for framer-motion — avoids JSDOM animation issues
import React from 'react';

const motion: Record<string, React.FC<React.HTMLAttributes<HTMLElement> & { [key: string]: unknown }>> = new Proxy({} as Record<string, React.FC>, {
  get: (_, tag: string) =>
    // eslint-disable-next-line react/display-name
    React.forwardRef(({ children, ...props }: React.HTMLAttributes<HTMLElement>, ref) => {
      // Remove framer-specific props
      const { whileHover, whileTap, initial, animate, exit, transition, layoutId, ...rest } = props as Record<string, unknown>;
      void whileHover; void whileTap; void initial; void animate; void exit; void transition; void layoutId;
      return React.createElement(tag, { ...rest, ref }, children as React.ReactNode);
    }),
});

const AnimatePresence: React.FC<{ children: React.ReactNode }> = ({ children }) =>
  React.createElement(React.Fragment, null, children);

export { motion, AnimatePresence };
export default { motion, AnimatePresence };
