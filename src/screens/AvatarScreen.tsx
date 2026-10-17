import { useState } from 'react';
import { buyItem, updateAvatar, useStore } from '../engine/store';
import { SHOP, colourOf, isOwned, type Slot } from '../engine/avatar';
import { Avatar } from '../components/Avatar';
import { Toast } from '../components/common';
import { sfx } from '../engine/sfx';
import { t } from '../locale';

const TABS: Slot[] = ['hat', 'face', 'shirt', 'pants', 'skin'];
const HAT_ICON: Record<string, string> = {
  none: '🚫', cap: '🧢', beanie: '🧶', party: '🥳', headphones: '🎧', tophat: '🎩', helmet: '👨‍🚀', crown: '👑'
};
const FACE_ICON: Record<string, string> = { smile: '🙂', grin: '😁', wink: '😉', wow: '😮', cool: '😎', stars: '🤩' };

export function AvatarScreen() {
  const look = useStore((s) => s.avatar);
  const coins = useStore((s) => s.coins);
  const owned = useStore((s) => s.owned);
  const [tab, setTab] = useState<Slot>('hat');
  const [toast, setToast] = useState('');
  const [mood, setMood] = useState<'jump' | 'wave'>('wave');
  const [k, setK] = useState(0);

  const choose = (slot: Slot, value: string, price: number, id: string, have: boolean) => {
    if (!have) {
      if (!buyItem(id, price)) {
        sfx.wrong();
        setToast(t('avatar.notEnough'));
        return;
      }
      sfx.coin();
      setToast(t('avatar.bought'));
    } else sfx.tap();
    updateAvatar({ [slot]: value });
    setMood('jump');
    setK((x) => x + 1);
  };

  return (
    <div className="page">
      <div className="row" style={{ marginBottom: 10 }}>
        <h1 style={{ margin: 0, flex: 1 }}>🧍 {t('avatar.title')}</h1>
        <span className="stat coins">🪙 {coins}</span>
      </div>
      <div className="locker">
        <div className="locker-stage">
          <Avatar key={k} look={look} size={180} mood={mood} />
        </div>
        <p className="small muted" style={{ textAlign: 'center', margin: 0 }}>
          {t('avatar.intro')}
        </p>
        <div className="shop-tabs seg" role="tablist">
          {TABS.map((s) => (
            <button key={s} className={tab === s ? 'on' : ''} onClick={() => setTab(s)} role="tab" aria-selected={tab === s}>
              {t(`avatar.${s}`)}
            </button>
          ))}
        </div>
        <div className="shop-grid">
          {SHOP.filter((i) => i.slot === tab).map((i) => {
            const have = isOwned(i, owned);
            const on = look[i.slot] === i.value;
            return (
              <button
                key={i.id}
                className={`shop-item ${on ? 'on' : ''} ${have ? '' : 'locked-item'}`}
                onClick={() => choose(i.slot, i.value, i.price, i.id, have)}
                aria-pressed={on}
              >
                {i.slot === 'hat' ? (
                  <span style={{ fontSize: '2.2rem' }}>{HAT_ICON[i.value]}</span>
                ) : i.slot === 'face' ? (
                  <span style={{ fontSize: '2.2rem' }}>{FACE_ICON[i.value]}</span>
                ) : (
                  <span className="swatch" style={{ background: colourOf(i.slot, i.value) }} />
                )}
                <span>{i.name}</span>
                <span className="price">{on ? `✅ ${t('avatar.wearing')}` : have ? t('avatar.wear') : `🪙 ${i.price}`}</span>
              </button>
            );
          })}
        </div>
      </div>
      {toast && <Toast text={toast} onDone={() => setToast('')} />}
    </div>
  );
}
