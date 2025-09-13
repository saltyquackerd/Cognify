import ChatBox from './ChatBox';
import MessageList from './MessageList';

export default function Home() {
  return (
    <div className="h-screen flex">
      <MessageList />
      <ChatBox />
    </div>
  );
}
