puzzles-chat
============

Classroom Chat and Question/Answer Board app using Node.js, socket.io, angular.js and express.js. The app gives teachers live feedback from their students during lecture. It can also be used for organizing quizzes in other settings.

Users can create quizzes and add questions to them. Questions can then be 'activated', allowing other
users to answer them live. Each quiz has a chatroom with multiple topics. The owner of the quiz can activate or deactivate the chat at any time. Latex code can be embedded in textual content with double or triple dollar-signs, $$\alpha$$ or $$$\alpha$$$ 

When answers are submitted, the quiz-owner gets live feedback in an admin-dashboard. When the quiz is completed, detailed responses can be listed. Quizzes can be either private or public, and access can easily be granted to quizzes by grouping users into 'groups'

## Installation instructions
- Clone repository
- Run 
  ``` 
  npm install
  ``` 
- Make sure mongodb is installed.
- Start the server with 
  ``` 
  node server.js
  ```
