
# What is this? 
It's currently a server that serves a website. 

Users can login with a name and they appear on screen as a big dot. 

They can move around within the box and they can enter a message that appears as a speech bubble above their big dot.

# Getting Started
```
npm install
npm start
```

## Recent Changes

- on-screen buttons for player control
- text entry and speech bubbles for each player
- screen set to take up the top half of the screen including:
    - Mobile-Specific Improvements:
    - Smaller player circles and buttons on mobile devices
    - Adjusted font sizes for better readability
    - Optimized touch targets for mobile interaction
    - Better spacing and padding for mobile screens
    - Arrow symbols (↑←→↓) for direction buttons to save space

- Holding movement keys down means that the player continually moves. 
- Also added persistent messages.
- magic door.
- Collision Detection: Checks if a player is touching the door using circle-rectangle collision detection
- Interaction Cooldown: Prevents spam interactions (1 second cooldown per player)
- Visual Feedback:

- Door glows when interacted with
- Door scales up briefly when any player interacts
- Floating text shows interaction messages

- Real-time Updates: Shows when other players interact with the door

- Broadcasting: All players see when someone interacts with the door

## Journey

- User makes a door appear.
- User needs a key, how do they know? A big key hole?
- Ask for a key and three appear, try each one and when they have the right one the screen goes black once they touch the door.
- Pick a key up and take it to a door it won't work. At some point the user will realise they can carry three keys at once and then have to picked up in a particular order.

## Dev Chat

- Door is an object that requires an interaction and can not be carried. 
- Key is an object that requires an interaction and can be carried. 

## Requests
Make the player area fit the screen.
Holding down on the on screen button makes the player move. Maybe we try swipes instead?


## Links

https://open-xrvb.onrender.com/
