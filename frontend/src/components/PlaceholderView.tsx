import React from 'react';
import { motion } from 'framer-motion';
import { HelpCircle } from 'lucide-react';

interface PlaceholderViewProps {
  moduleName: string;
  icon: React.ReactNode;
}

export const PlaceholderView: React.FC<PlaceholderViewProps> = ({ moduleName, icon }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-surface-container dark:bg-dark-surface-container p-8 rounded-2xl shadow-sm border border-outline-variant dark:border-dark-outline-variant text-center max-w-lg mx-auto my-12"
    >
      <div className="inline-flex p-4 bg-primary/10 rounded-2xl mb-4">
        {icon}
      </div>
      <h2 className="text-xl font-bold text-on-surface dark:text-dark-on-surface mb-2">
        {moduleName} Section
      </h2>
      <p className="text-sm text-on-surface-variant dark:text-dark-on-surface-variant mb-6">
        This sub-module navigation path is fully configured. The operational user interface views for this department segment are currently under active development.
      </p>
      <div className="inline-flex items-center gap-2 text-xs font-semibold py-1.5 px-3 bg-surface-container-low dark:bg-dark-surface-container-low border border-outline-variant dark:border-dark-outline-variant rounded-full text-outline">
        <HelpCircle className="w-4 h-4" />
        <span>Sub-path: {window.location.pathname}</span>
      </div>
    </motion.div>
  );
};
