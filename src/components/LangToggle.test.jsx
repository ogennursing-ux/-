import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LangToggle from './LangToggle.jsx';
import { LangContext } from '../lib/i18n.js';

function renderWithLang(lang, setLang = () => {}) {
  return render(
    <LangContext.Provider value={{ lang, setLang }}>
      <LangToggle />
    </LangContext.Provider>,
  );
}

describe('<LangToggle>', () => {
  it('shows "EN" when the UI is in Hebrew', () => {
    renderWithLang('he');
    expect(screen.getByRole('button')).toHaveTextContent('EN');
  });

  it('shows "עב" when the UI is in English', () => {
    renderWithLang('en');
    expect(screen.getByRole('button')).toHaveTextContent('עב');
  });

  it('switches to English when clicked in Hebrew mode', async () => {
    const setLang = vi.fn();
    renderWithLang('he', setLang);
    await userEvent.click(screen.getByRole('button'));
    expect(setLang).toHaveBeenCalledWith('en');
  });

  it('switches to Hebrew when clicked in English mode', async () => {
    const setLang = vi.fn();
    renderWithLang('en', setLang);
    await userEvent.click(screen.getByRole('button'));
    expect(setLang).toHaveBeenCalledWith('he');
  });

  it('exposes an accessible label', () => {
    renderWithLang('he');
    expect(screen.getByLabelText('Switch language')).toBeInTheDocument();
  });
});
