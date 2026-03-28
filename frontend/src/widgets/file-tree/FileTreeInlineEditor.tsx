import { useEffect, useRef } from 'react';
import { Icon, type IconName } from '@uikit/icon';
import styles from './FileTree.module.scss';

interface FileTreeInlineEditorProps {
  depth: number;
  iconName: IconName;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
  onCancel: () => void;
}

export function FileTreeInlineEditor({
  depth,
  iconName,
  value,
  placeholder,
  onChange,
  onSubmit,
  onCancel,
}: FileTreeInlineEditorProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const skipBlurRef = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <div
      className={`${styles.item} ${styles.itemEditing}`}
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
    >
      <span className={styles.icon}>
        <Icon name={iconName} size={16} />
      </span>
      <input
        ref={inputRef}
        className={styles.inlineInput}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => {
          if (skipBlurRef.current) {
            skipBlurRef.current = false;
            return;
          }
          void onSubmit();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            event.currentTarget.blur();
          }

          if (event.key === 'Escape') {
            event.preventDefault();
            skipBlurRef.current = true;
            onCancel();
          }
        }}
      />
    </div>
  );
}
