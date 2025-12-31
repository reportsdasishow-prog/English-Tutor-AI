
import React from 'react';
import { Scenario } from '../types';

interface ScenarioCardProps {
  scenario: Scenario;
  isSelected: boolean;
  onSelect: (id: string) => void;
  disabled?: boolean;
}

export const ScenarioCard: React.FC<ScenarioCardProps> = ({ 
  scenario, 
  isSelected, 
  onSelect,
  disabled 
}) => {
  return (
    <button
      onClick={() => onSelect(scenario.id)}
      disabled={disabled}
      className={`flex flex-col items-center p-6 rounded-2xl transition-all duration-300 border-2 text-center group ${
        isSelected 
          ? 'bg-blue-50 border-blue-500 shadow-lg scale-105' 
          : 'bg-white border-slate-100 hover:border-blue-200 hover:shadow-md'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors ${
        isSelected ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-500'
      }`}>
        <i className={`fa-solid ${scenario.icon} text-2xl`}></i>
      </div>
      <h3 className={`font-bold text-lg mb-2 ${isSelected ? 'text-blue-700' : 'text-slate-800'}`}>
        {scenario.title}
      </h3>
      <p className="text-sm text-slate-500 leading-relaxed">
        {scenario.description}
      </p>
    </button>
  );
};
