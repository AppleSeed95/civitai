import produce from 'immer';
import { useCallback } from 'react';
import useSound from 'use-sound';
import { useSignalConnection } from '~/components/Signals/SignalsProvider';
import { useCurrentUser } from '~/hooks/useCurrentUser';
import { SignalMessages } from '~/server/common/enums';
import { ChatAllMessages, ChatCreateChat } from '~/types/router';
import { trpc } from '~/utils/trpc';

const messageSound = '/sounds/message2.mp3'; // message

export const useChatNewMessageSignal = () => {
  const queryUtils = trpc.useUtils();
  const currentUser = useCurrentUser();
  const [play] = useSound(messageSound, { volume: 0.5 });

  const onUpdate = useCallback(
    (updated: ChatAllMessages[number]) => {
      // queryUtils.chat.getInfiniteMessages.cancel();

      queryUtils.chat.getInfiniteMessages.setInfiniteData(
        { chatId: updated.chatId },
        produce((old) => {
          if (!old) return old;

          const lastPage = old.pages[old.pages.length - 1];

          lastPage.items.push(updated);
        })
      );

      queryUtils.chat.getAllByUser.setData(
        undefined,
        produce((old) => {
          if (!old) return old;

          const thisChat = old.find((o) => o.id === updated.chatId);
          if (!thisChat) return old;
          thisChat.messages = [{ content: updated.content }]; //, contentType: updated.contentType
        })
      );

      if (updated.userId !== currentUser?.id) {
        queryUtils.chat.getUnreadCount.setData(
          undefined,
          produce((old) => {
            if (!old) return old;

            const tChat = old.find((c) => c.chatId === updated.chatId);
            if (!tChat) {
              old.push({ chatId: updated.chatId, cnt: 1 });
            } else {
              tChat.cnt++;
            }
          })
        );
      }

      const userSettings = queryUtils.chat.getUserSettings.getData();
      // this will play if no key is present (default not muted)
      if (userSettings?.muteSounds !== true && updated.userId !== currentUser?.id) {
        // TODO maybe only play if window is open?
        play();
      }
    },
    [queryUtils, play]
  );

  useSignalConnection(SignalMessages.ChatNewMessage, onUpdate);
};

export const useChatNewRoomSignal = () => {
  const queryUtils = trpc.useUtils();
  const currentUser = useCurrentUser();
  const [play] = useSound(messageSound, { volume: 0.5 });

  const onUpdate = useCallback(
    (updated: ChatCreateChat) => {
      queryUtils.chat.getAllByUser.setData(undefined, (old) => {
        if (!old) return [updated];
        return [updated, ...old];
      });

      if (updated.ownerId !== currentUser?.id) {
        queryUtils.chat.getUnreadCount.setData(
          undefined,
          produce((old) => {
            if (!old) return old;
            old.push({ chatId: updated.id, cnt: 1 });
          })
        );

        const userSettings = queryUtils.chat.getUserSettings.getData();
        if (userSettings?.muteSounds !== true) {
          play();
        }
      }
    },
    [queryUtils, play]
  );

  useSignalConnection(SignalMessages.ChatNewRoom, onUpdate);
};
