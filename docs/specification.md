# Specification & Functional Requirements

Bee TV is a streaming platform and application to allow user enjoyng their favorite series and TV shows.

This document describes the "Interactive TV Series" core module.

## Features

### TVMaze API

The TVMaze API is the public and core datasource for Bee TV platform. It is not exactly a feature, but a business partner of our product.

Integrations with the API is a core concern and capability of the solution. There is the expectation to allow another partner (exchangeable) in near future. That is, the solution should be proof of _vendor lock-in_.

### 1. Search interface for TV Series

* Provide a search interface where users can search for TV series.
* Display results asynchronously (title, year, poster).
* Use the public TVMaze API:
* GET http://api.tvmaze.com/search/shows?q=QUERY

#### UI Hints

* It is the application home page
* Provides a search bar like the one provided by search engines like Google
* Grid display, tiles-based, and responsive UI to show the results

### 2. TV Series Details

When a series is selected, display:
* Poster
* Summary
* Genres
* List of episodes grouped by season

It is separated and dedicated page with a proper url for details.

* APIs:
  * GET http://api.tvmaze.com/shows/{ID}
  * GET http://api.tvmaze.com/shows/{ID}/episodes

#### UI Hints

* UI elements order: poster (left-aligned), summary (right-aligned), genres (below summary description)
    * List of episodes grouped by season: below the main components (next row)
* Provides a search bar like the one provided by search engines like Google
* Grid display, tiles-based, and responsive UI to show the results

### 3. Episode Tracking & Comments

On the TV Series detail page:

* Users can mark episodes as watched
* Users can leave comments on:
  * A series
  * Or a specific episode
* Watched state and comments must persist across navigation and reloads

#### UI Hints

* A text area and "Comment" button are shown below the episodes grid. "Comment" button below the text area and right-aligned 
* Comments are shown below the "Comment" button
* A ruler (separator) is a nice-have in the UI experience

For episodes:

* A toggle button alongside the episode title to indicate if the user has watched or not
* A button labeled with the numbers of comments for the episode
* When a user click on the episode's comments button, shows a pop-up where it contains the same layout of the series comments but scoped to a episode
* The pop-up has no custom actions buttons. Just the "system layout" button to close it

### 4. Bee TV Review

It is the AI-powered insights offered by Bee TV. It can generate insights for a TV Series or a specific TV Series episode.

The insight should be based on:
* Series or episode summary
* Genres
* (Optional) user comments

#### UI Hints

* Below the TV Series poster, display an _AI Magic-like_ "Bee Review" button
* The AI-powered review is displayed within a pop-up.
* User can toggle to consider or not the users opinion to compile the review
* Same UI structure for episodes where a new button alongside the comments button should be shown. The button opens the pop-up containing the review for the episode

#### Constraints

* Use HuggingFace Inference API (free tier)
* The AI integration must:
  * Be isolated behind an interface
  * Handle failures gracefully
  * Have a clear fallback strategy