/**
 * Accessibility & component tests for Navbar and SettingsModal.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// ─────────────────────────────────────────────
// Mock audio lib
// ─────────────────────────────────────────────
jest.mock('@/lib/audio', () => ({
  soundFx: { enabled: true, playPaymentSuccess: jest.fn() },
}));

jest.mock('@/components/SandboxProfilePill', () => ({
  SandboxProfilePill: () => <div data-testid="sandbox-profile-pill" />,
}));

import { Navbar } from '@/components/Navbar';
import { SettingsModal } from '@/components/SettingsModal';

// ─────────────────────────────────────────────
// Navbar Tests
// ─────────────────────────────────────────────
describe('Navbar — accessibility', () => {
  const defaultProps = {
    activeTab: 'copilot',
    setActiveTab: jest.fn(),
    totalTreasury: 12345.67,
    onOpenSettings: jest.fn(),
    onOpenTopup: jest.fn(),
    isSandboxMode: true,
  };

  it('renders a <nav> landmark element', () => {
    const { container } = render(<Navbar {...defaultProps} />);
    expect(container.querySelector('nav')).toBeInTheDocument();
  });

  it('renders all 5 navigation tabs', () => {
    render(<Navbar {...defaultProps} />);
    expect(screen.getByText('AI Copilot & Fleet')).toBeInTheDocument();
    expect(screen.getByText('AG Grid Ledger')).toBeInTheDocument();
    expect(screen.getByText('Agent Wallets')).toBeInTheDocument();
    expect(screen.getByText('Milestone Escrow')).toBeInTheDocument();
    expect(screen.getByText('SubSense Arbiter')).toBeInTheDocument();
  });

  it('calls setActiveTab when a tab is clicked', () => {
    const mockSetTab = jest.fn();
    render(<Navbar {...defaultProps} setActiveTab={mockSetTab} />);
    fireEvent.click(screen.getByText('AG Grid Ledger'));
    expect(mockSetTab).toHaveBeenCalledWith('ledger');
  });

  it('settings button has an accessible title', () => {
    render(<Navbar {...defaultProps} />);
    const settingsBtn = screen.getByTitle('Configure Credentials');
    expect(settingsBtn).toBeInTheDocument();
  });

  it('calls onOpenSettings when settings button is clicked', () => {
    const mockOpenSettings = jest.fn();
    render(<Navbar {...defaultProps} onOpenSettings={mockOpenSettings} />);
    fireEvent.click(screen.getByTitle('Configure Credentials'));
    expect(mockOpenSettings).toHaveBeenCalled();
  });

  it('calls onOpenTopup when + button is clicked', () => {
    const mockOpenTopup = jest.fn();
    render(<Navbar {...defaultProps} onOpenTopup={mockOpenTopup} />);
    fireEvent.click(screen.getByTitle('Add Sandbox Liquidity'));
    expect(mockOpenTopup).toHaveBeenCalled();
  });

  it('displays formatted treasury value', () => {
    render(<Navbar {...defaultProps} totalTreasury={12345.67} />);
    expect(screen.getByText('$12,345.67')).toBeInTheDocument();
  });

  it('shows Sandbox Live badge when isSandboxMode is true', () => {
    render(<Navbar {...defaultProps} isSandboxMode={true} />);
    expect(screen.getByText('Sandbox Live')).toBeInTheDocument();
  });

  it('renders Judge Demo Tour button when handler provided', () => {
    render(<Navbar {...defaultProps} onRunJudgeTour={jest.fn()} isTourRunning={false} />);
    expect(screen.getByTitle('Run 1-Click Interactive Judge Demo Walkthrough')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────
// SettingsModal Tests
// ─────────────────────────────────────────────
describe('SettingsModal — accessibility & security', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    paypalClientId: '',
    paypalSecret: '',
    geminiKey: '',
    onSaveSettings: jest.fn(),
  };

  it('does not render when isOpen=false', () => {
    const { container } = render(<SettingsModal {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders modal with form inputs when isOpen=true', () => {
    render(<SettingsModal {...defaultProps} />);
    expect(screen.getByPlaceholderText(/A21AAJ/i)).toBeInTheDocument();
  });

  it('renders PayPal Secret as password field', () => {
    render(<SettingsModal {...defaultProps} />);
    const inputs = screen.getAllByDisplayValue('');
    // At least one input should be of type password
    const passwordInputs = inputs.filter((el) => el.getAttribute('type') === 'password');
    expect(passwordInputs.length).toBeGreaterThanOrEqual(1);
  });

  it('calls onClose when Cancel is clicked', () => {
    const mockClose = jest.fn();
    render(<SettingsModal {...defaultProps} onClose={mockClose} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(mockClose).toHaveBeenCalled();
  });

  it('calls onSaveSettings with form values on submit', () => {
    const mockSave = jest.fn();
    render(<SettingsModal {...defaultProps} onSaveSettings={mockSave} />);
    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0], { target: { value: 'test-client-id' } });
    fireEvent.click(screen.getByText('Save Config'));
    expect(mockSave).toHaveBeenCalledWith('test-client-id', '', '');
  });

  it('Auto-Fill Sandbox Defaults button does NOT hardcode real credentials', () => {
    render(<SettingsModal {...defaultProps} />);
    const autoFillBtn = screen.queryByText(/Auto-Fill Sandbox Defaults/i);
    if (autoFillBtn) {
      fireEvent.click(autoFillBtn);
      // After clicking, fields should either be empty or show placeholder text
      // Real production credentials should NOT appear in the DOM
      const allInputs = document.querySelectorAll('input');
      allInputs.forEach((input) => {
        const val = (input as HTMLInputElement).value;
        // Should not contain long base64-like credential strings
        expect(val.length).toBeLessThan(50);
      });
    }
  });

  it('has accessible labels for all form fields', () => {
    render(<SettingsModal {...defaultProps} />);
    expect(screen.getByText('PayPal Sandbox Client ID')).toBeInTheDocument();
    expect(screen.getByText('PayPal Sandbox Secret')).toBeInTheDocument();
    expect(screen.getByText('Google Gemini API Key')).toBeInTheDocument();
  });

  it('heading is present for screen readers', () => {
    render(<SettingsModal {...defaultProps} />);
    expect(screen.getByText('API Credentials & Sandbox Config')).toBeInTheDocument();
  });
});
