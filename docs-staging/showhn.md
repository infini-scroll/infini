Show HN: Infini – Bidirectional virtual scrolling with free discrete jumping
https://infini.flysoftbeta.top/

Hi HN,

I'm building Infini, a virtual scrolling engine that takes care of both geometry and data loading.
Try it online, in your browser: https://infini.flysoftbeta.top/playground

I was building a social client back then, with chat and long article support. For chats, it was really a headache handling Discord-like "start from where you left", which means you need to start from the middle of the feed, and "click on reply", which you need to jump to an arbitrary item with its ID, all with @tanstack/virtual. (1st real world usage: https://github.com/FlysoftBeta/classapp/blob/main/client/components/chat/ChatMessageList.tsx)

TanStack virtual only has proper support for starting from one side, so for chat, I have to load the latest messages first, then keep loading forward by prepending items array until locate the message I want.

Infini handles this by using Islands, which are contiguous portions of data. Discrete jump makes new islands, which eliminates the requirement of having one single contiguous item array, while old islands are retained for going back. Inside the main island the user is on, I use an implicit treap to handle range sum (extent + length) faster.

It's headless at the core. The core uses Rust, bridged to TypeScript - the React bindings are just one integration.

Still very early, feedback and edge cases are very welcome, especially around frameworks other than React.

Repo: https://github.com/infini-scroll/infini
