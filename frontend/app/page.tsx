import ChatBox from './ChatBox';
import MessageList from './MessageList';

export default function Home() {
  return (
    <div className="h-screen flex">
      <MessageList />
      <div className="flex-1">
        <ChatBox />
      </div>
    </div>
  );
}
